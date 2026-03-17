package org.verdikt.service;

import org.springframework.stereotype.Service;
import org.verdikt.chat.dto.ChooseTopicResponse;
import org.verdikt.chat.dto.TopicChoiceItem;
import org.verdikt.chat.model.ConversationState;
import org.verdikt.chat.model.TopicMemory;
import org.verdikt.entity.Chat;
import org.verdikt.entity.User;
import org.verdikt.repository.ChatRepository;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Orchestrates the chat turn pipeline: topic routing, rewrite, RAG, generation.
 * Does not call LLM for streaming — returns prepared body for LlmWebSocketHandler.
 */
@Service
public class ChatOrchestratorService {

    private final ChatRepository chatRepository;
    private final ChatHistoryService chatHistoryService;
    private final ChatTurnProcessor chatTurnProcessor;
    private final RewriteService rewriteService;
    private final TopicMemoryService topicMemoryService;

    public ChatOrchestratorService(ChatRepository chatRepository,
                                  ChatHistoryService chatHistoryService,
                                  ChatTurnProcessor chatTurnProcessor,
                                  RewriteService rewriteService,
                                  TopicMemoryService topicMemoryService) {
        this.chatRepository = chatRepository;
        this.chatHistoryService = chatHistoryService;
        this.chatTurnProcessor = chatTurnProcessor;
        this.rewriteService = rewriteService;
        this.topicMemoryService = topicMemoryService;
    }

    /**
     * Process a turn. Returns either choose_topic (no LLM) or stream request (body + state).
     */
    public OrchestratorResult processTurn(User user, String chatKey, String message, String selectedTopicId) {
        if (message == null || message.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Сообщение не может быть пустым");
        }

        String effectiveChatKey = chatKey != null && !chatKey.isBlank()
                ? chatKey
                : java.util.UUID.randomUUID().toString();

        Chat chat = chatRepository.findByUserIdAndChatKey(user.getId(), effectiveChatKey)
                .orElseGet(() -> {
                    Chat c = new Chat();
                    c.setUser(user);
                    c.setChatKey(effectiveChatKey);
                    return c;
                });

        ConversationState state = chatHistoryService.parseConversationState(chat);

        TurnDecision decision = chatTurnProcessor.decide(state, message, selectedTopicId);

        if (decision.getType() == TurnDecision.Type.ASK_USER_TO_CHOOSE) {
            Long messageId = chatHistoryService.saveUserMessageOnly(user, effectiveChatKey, message);
            ChooseTopicResponse response = new ChooseTopicResponse();
            response.setChatId(effectiveChatKey);
            response.setMessageId(messageId);
            List<TopicChoiceItem> items = new ArrayList<>();
            for (TopicMemory t : decision.getTopics()) {
                items.add(new TopicChoiceItem(t.getTopicId(), t.getDisplayTitle()));
            }
            response.setTopics(items);
            return new OrchestratorResult.ChooseTopic(response);
        }

        if (decision.getType() == TurnDecision.Type.FIRST_MESSAGE) {
            String effectiveQuery = message;
            Map<String, Object> body = buildBody(effectiveChatKey, message, effectiveQuery);
            state.setTurnCounter(0);
            return new OrchestratorResult.Stream(body, state, message, effectiveQuery, false);
        }

        TopicMemory topic = decision.getTopic();
        String rewrite = rewriteService.rewrite(topic, message);
        String effectiveQuery = rewrite != null && !rewrite.isBlank() ? rewrite : message;

        Map<String, Object> body = buildBody(effectiveChatKey, message, effectiveQuery);
        boolean skipUser = selectedTopicId != null && !selectedTopicId.isBlank();

        return new OrchestratorResult.Stream(body, state, message, effectiveQuery, skipUser);
    }

    /**
     * Called after streaming completes. Updates topic memory and returns state to persist.
     */
    public ConversationState finishTurn(OrchestratorResult.Stream streamResult,
                                        String assistantText,
                                        List<Long> ragItemIds) {
        ConversationState state = streamResult.state();
        String rawMessage = streamResult.rawUserMessage();
        int turn = state.getTurnCounter() + 1;

        if (state.getTopics().isEmpty()) {
            String effectiveQuery = (String) streamResult.body().get("ragQuery");
            if (effectiveQuery == null) effectiveQuery = rawMessage;
            chatTurnProcessor.initializeFirstTopic(state, rawMessage, effectiveQuery, ragItemIds);
        } else {
            TopicMemory topic = state.getTopics().stream()
                    .filter(t -> t.getTopicId().equals(state.getActiveTopicId()))
                    .findFirst()
                    .orElse(null);
            if (topic != null) {
                String rewrite = streamResult.effectiveQuery();
                if (rewrite == null) rewrite = rawMessage;
                String summary = buildAssistantSummary(assistantText);
                topicMemoryService.updateTopic(topic, rawMessage, rewrite, summary, ragItemIds, turn);
            }
            state.setTurnCounter(turn);
        }

        return state;
    }

    private Map<String, Object> buildBody(String chatKey, String rawUserMessage, String ragQuery) {
        Map<String, Object> body = new HashMap<>();
        body.put("chatId", chatKey);
        List<Map<String, Object>> messages = new ArrayList<>();
        Map<String, Object> userMsg = new HashMap<>();
        userMsg.put("role", "user");
        userMsg.put("content", rawUserMessage);
        messages.add(userMsg);
        body.put("messages", messages);
        body.put("ragQuery", ragQuery);
        return body;
    }

    private String buildAssistantSummary(String assistantText) {
        if (assistantText == null || assistantText.isBlank()) {
            return "Discussed the user's question.";
        }
        String trimmed = assistantText.trim();
        if (trimmed.length() <= 120) return trimmed;
        return trimmed.substring(0, 120) + "...";
    }
}
