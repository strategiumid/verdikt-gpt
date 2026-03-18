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
    private final MemoryUpdateService memoryUpdateService;

    public ChatOrchestratorService(ChatRepository chatRepository,
                                  ChatHistoryService chatHistoryService,
                                  ChatTurnProcessor chatTurnProcessor,
                                  RewriteService rewriteService,
                                  TopicMemoryService topicMemoryService,
                                  MemoryUpdateService memoryUpdateService) {
        this.chatRepository = chatRepository;
        this.chatHistoryService = chatHistoryService;
        this.chatTurnProcessor = chatTurnProcessor;
        this.rewriteService = rewriteService;
        this.topicMemoryService = topicMemoryService;
        this.memoryUpdateService = memoryUpdateService;
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
            String contextQuery = message;
            Map<String, Object> body = buildBody(effectiveChatKey, message, contextQuery, contextQuery);
            state.setTurnCounter(0);
            return new OrchestratorResult.Stream(body, state, message, contextQuery, false);
        }

        TopicMemory topic = decision.getTopic();
        // Контекст для LLM и RAG: последние 10 user-сообщений + текущее
        String contextQuery = chatHistoryService.buildLastUserMessagesContext(user, effectiveChatKey, message, 10);
        // При этом всё ещё делаем rewrite и сохраняем его в памяти темы (для последующих turn'ов),
        // но retrieval и LLM получают контекстный запрос, чтобы лучше понимать историю.
        String rewrite = rewriteService.rewrite(topic, message);
        String effectiveRewrite = (rewrite != null && !rewrite.isBlank()) ? rewrite : message;

        Map<String, Object> body = buildBody(effectiveChatKey, message, contextQuery, contextQuery);
        boolean skipUser = selectedTopicId != null && !selectedTopicId.isBlank();

        return new OrchestratorResult.Stream(body, state, message, effectiveRewrite, skipUser);
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
            TopicMemory topic = state.getTopics().isEmpty() ? null : state.getTopics().get(0);
            if (topic != null) {
                var update = memoryUpdateService.buildUpdate(
                        topic.getTopicLabel(),
                        topic.getDisplayTitle(),
                        topic.getUserGoal(),
                        topic.getFactsFromUser(),
                        rawMessage,
                        assistantText
                );
                memoryUpdateService.applyToTopic(topic, update);
            }
        } else {
            TopicMemory topic = state.getTopics().stream()
                    .filter(t -> t.getTopicId().equals(state.getActiveTopicId()))
                    .findFirst()
                    .orElse(null);
            if (topic != null) {
                String rewrite = streamResult.effectiveQuery();
                if (rewrite == null) rewrite = rawMessage;
                topicMemoryService.updateTopic(topic, rawMessage, rewrite, topic.getAssistantReferenceSummary(), ragItemIds, turn);
                var update = memoryUpdateService.buildUpdate(
                        topic.getTopicLabel(),
                        topic.getDisplayTitle(),
                        topic.getUserGoal(),
                        topic.getFactsFromUser(),
                        rawMessage,
                        assistantText
                );
                memoryUpdateService.applyToTopic(topic, update);
            }
            state.setTurnCounter(turn);
        }

        return state;
    }

    private Map<String, Object> buildBody(String chatKey, String rawUserMessage, String llmUserMessage, String ragQuery) {
        Map<String, Object> body = new HashMap<>();
        body.put("chatId", chatKey);
        body.put("originalUserMessage", rawUserMessage);
        List<Map<String, Object>> messages = new ArrayList<>();
        Map<String, Object> userMsg = new HashMap<>();
        userMsg.put("role", "user");
        userMsg.put("content", llmUserMessage != null ? llmUserMessage : "");
        messages.add(userMsg);
        body.put("messages", messages);
        body.put("ragQuery", ragQuery);
        return body;
    }

}
