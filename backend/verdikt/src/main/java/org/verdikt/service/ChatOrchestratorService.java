package org.verdikt.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.verdikt.chat.dto.ChooseTopicResponse;
import org.verdikt.chat.dto.TopicChoiceItem;
import org.verdikt.chat.model.ConversationState;
import org.verdikt.chat.model.TopicMemory;
import org.verdikt.dto.ChatCompletionsRequest;
import org.verdikt.dto.multimodal.MultimodalResult;
import org.verdikt.dto.multimodal.RetrievalQuery;
import org.verdikt.entity.Chat;
import org.verdikt.entity.User;
import org.verdikt.repository.ChatRepository;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Orchestrates the chat turn pipeline: topic routing, optional multimodal preprocessing, rewrite, then
 * a {@link ChatCompletionsRequest} for streaming. Does not call the main LLM itself.
 */
@Service
public class ChatOrchestratorService {

    private static final int USER_CONTEXT_MESSAGE_WINDOW = 10;

    private final ChatRepository chatRepository;
    private final ChatHistoryService chatHistoryService;
    private final ChatTurnProcessor chatTurnProcessor;
    private final RewriteService rewriteService;
    private final TopicMemoryService topicMemoryService;
    private final MemoryUpdateService memoryUpdateService;
    private final MultimodalPreprocessingService multimodalPreprocessingService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ChatOrchestratorService(ChatRepository chatRepository,
                                 ChatHistoryService chatHistoryService,
                                 ChatTurnProcessor chatTurnProcessor,
                                 RewriteService rewriteService,
                                 TopicMemoryService topicMemoryService,
                                 MemoryUpdateService memoryUpdateService,
                                 MultimodalPreprocessingService multimodalPreprocessingService) {
        this.chatRepository = chatRepository;
        this.chatHistoryService = chatHistoryService;
        this.chatTurnProcessor = chatTurnProcessor;
        this.rewriteService = rewriteService;
        this.topicMemoryService = topicMemoryService;
        this.memoryUpdateService = memoryUpdateService;
        this.multimodalPreprocessingService = multimodalPreprocessingService;
    }

    /**
     * Run routing and preprocessing for one user turn.
     *
     * @return either a topic-choice response (no LLM) or a stream payload plus conversation state
     */
    public OrchestratorResult processTurn(User user,
                                          String chatKey,
                                          String message,
                                          String selectedTopicId,
                                          List<String> imageIds) {
        requireNonBlankMessage(message);

        String effectiveChatKey = resolveChatKey(chatKey);
        Chat chat = loadOrCreateChatPlaceholder(user, effectiveChatKey);
        ConversationState state = chatHistoryService.parseConversationState(chat);

        TurnDecision decision = chatTurnProcessor.decide(state, message, selectedTopicId);

        return switch (decision.getType()) {
            case ASK_USER_TO_CHOOSE -> askUserToChooseTopic(user, effectiveChatKey, message, imageIds, decision);
            case FIRST_MESSAGE -> streamNewConversation(user, effectiveChatKey, message, imageIds, state);
            case USE_TOPIC -> streamWithExistingTopic(
                    user, effectiveChatKey, message, imageIds, selectedTopicId, state, decision.getTopic());
        };
    }

    /**
     * After the assistant reply is streamed: initialize or update topic memory and bump turn counter when applicable.
     */
    public ConversationState finishTurn(OrchestratorResult.Stream stream,
                                        String assistantText,
                                        List<Long> ragItemIds) {
        ConversationState state = stream.state();
        String rawUserMessage = stream.rawUserMessage();

        if (state.getTopics().isEmpty()) {
            initializeTopicAfterFirstStream(stream, state, rawUserMessage, assistantText, ragItemIds);
        } else {
            updateTopicAfterStream(stream, state, rawUserMessage, assistantText, ragItemIds);
        }
        return state;
    }

    // --- processTurn branches ---

    private OrchestratorResult askUserToChooseTopic(User user,
                                                    String chatKey,
                                                    String message,
                                                    List<String> imageIds,
                                                    TurnDecision decision) {
        List<String> cleanImageIds = normalizeImageIds(imageIds);
        String imageAnalysisJson = tryBuildImageAnalysisJson(user, message, cleanImageIds);

        Long messageId = chatHistoryService.saveUserMessageOnly(
                user, chatKey, message, cleanImageIds, imageAnalysisJson);

        ChooseTopicResponse response = new ChooseTopicResponse();
        response.setChatId(chatKey);
        response.setMessageId(messageId);
        response.setTopics(toTopicChoiceItems(decision.getTopics()));
        return new OrchestratorResult.ChooseTopic(response);
    }

    private OrchestratorResult streamNewConversation(User user,
                                                     String chatKey,
                                                     String message,
                                                     List<String> imageIds,
                                                     ConversationState state) {
        ChatCompletionsRequest request = newCompletionsRequest(chatKey, message, message, message);
        attachMultimodal(user, message, imageIds, request);
        state.setTurnCounter(0);
        return new OrchestratorResult.Stream(request, state, message, message, false);
    }

    private OrchestratorResult streamWithExistingTopic(User user,
                                                         String chatKey,
                                                         String message,
                                                         List<String> imageIds,
                                                         String selectedTopicId,
                                                         ConversationState state,
                                                         TopicMemory topic) {
        // RAG / LLM see recent user lines + current message; rewrite still runs for topic memory.
        String contextForLlm = chatHistoryService.buildLastUserMessagesContext(
                user, chatKey, message, USER_CONTEXT_MESSAGE_WINDOW);
        String rewrite = rewriteService.rewrite(topic, message);
        String effectiveRewrite = (rewrite != null && !rewrite.isBlank()) ? rewrite : message;

        ChatCompletionsRequest request = newCompletionsRequest(chatKey, message, contextForLlm, contextForLlm);
        attachMultimodal(user, message, imageIds, request);

        boolean skipSavingUserAgain = selectedTopicId != null && !selectedTopicId.isBlank();
        return new OrchestratorResult.Stream(request, state, message, effectiveRewrite, skipSavingUserAgain);
    }

    private void attachMultimodal(User user, String message, List<String> imageIds, ChatCompletionsRequest request) {
        List<String> cleanIds = normalizeImageIds(imageIds);
        if (cleanIds.isEmpty()) {
            return;
        }
        request.setImageIds(cleanIds);

        MultimodalResult multimodal = multimodalPreprocessingService.buildQueries(user, message, cleanIds);

        List<RetrievalQuery> queries = multimodal.queries();
        if (queries != null && !queries.isEmpty()) {
            List<String> texts = queries.stream()
                    .map(RetrievalQuery::text)
                    .filter(q -> q != null && !q.isBlank())
                    .toList();
            if (!texts.isEmpty()) {
                request.setRagQueries(texts);
                request.setRagQuery(texts.get(0));
            }
        }

        String analysisJson = serializeImageAnalysis(multimodal);
        if (analysisJson != null) {
            request.setImageAnalysis(analysisJson);
        }
    }

    // --- finishTurn ---

    private void initializeTopicAfterFirstStream(OrchestratorResult.Stream stream,
                                                 ConversationState state,
                                                 String rawUserMessage,
                                                 String assistantText,
                                                 List<Long> ragItemIds) {
        String ragQuery = stream.request().getRagQuery();
        String effectiveQuery = ragQuery != null ? ragQuery : rawUserMessage;

        chatTurnProcessor.initializeFirstTopic(state, rawUserMessage, effectiveQuery, ragItemIds);

        TopicMemory topic = state.getTopics().isEmpty() ? null : state.getTopics().get(0);
        if (topic != null) {
            applyMemoryUpdate(topic, rawUserMessage, assistantText);
        }
    }

    private void updateTopicAfterStream(OrchestratorResult.Stream stream,
                                        ConversationState state,
                                        String rawUserMessage,
                                        String assistantText,
                                        List<Long> ragItemIds) {
        int nextTurn = state.getTurnCounter() + 1;

        TopicMemory topic = findTopicById(state, state.getActiveTopicId());
        if (topic != null) {
            String rewrite = stream.effectiveQuery();
            if (rewrite == null) {
                rewrite = rawUserMessage;
            }
            topicMemoryService.updateTopic(
                    topic,
                    rawUserMessage,
                    rewrite,
                    topic.getAssistantReferenceSummary(),
                    ragItemIds,
                    nextTurn);
            applyMemoryUpdate(topic, rawUserMessage, assistantText);
        }
        state.setTurnCounter(nextTurn);
    }

    private void applyMemoryUpdate(TopicMemory topic, String rawUserMessage, String assistantText) {
        var update = memoryUpdateService.buildUpdate(
                topic.getTopicLabel(),
                topic.getDisplayTitle(),
                topic.getUserGoal(),
                topic.getFactsFromUser(),
                rawUserMessage,
                assistantText);
        memoryUpdateService.applyToTopic(topic, update);
    }

    // --- small helpers ---

    private static void requireNonBlankMessage(String message) {
        if (message == null || message.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Сообщение не может быть пустым");
        }
    }

    private static String resolveChatKey(String chatKey) {
        return (chatKey != null && !chatKey.isBlank()) ? chatKey : UUID.randomUUID().toString();
    }

    /**
     * Existing row from DB, or an in-memory placeholder for a new chat key (persisted when messages are saved).
     */
    private Chat loadOrCreateChatPlaceholder(User user, String chatKey) {
        return chatRepository.findByUserIdAndChatKey(user.getId(), chatKey)
                .orElseGet(() -> {
                    Chat c = new Chat();
                    c.setUser(user);
                    c.setChatKey(chatKey);
                    return c;
                });
    }

    private static List<String> normalizeImageIds(List<String> imageIds) {
        if (imageIds == null || imageIds.isEmpty()) {
            return List.of();
        }
        return imageIds.stream()
                .filter(id -> id != null && !id.isBlank())
                .map(String::trim)
                .distinct()
                .toList();
    }

    private String tryBuildImageAnalysisJson(User user, String message, List<String> cleanImageIds) {
        if (cleanImageIds.isEmpty()) {
            return null;
        }
        try {
            MultimodalResult multimodal = multimodalPreprocessingService.buildQueries(user, message, cleanImageIds);
            return serializeImageAnalysis(multimodal);
        } catch (Exception ignored) {
            return null;
        }
    }

    private String serializeImageAnalysis(MultimodalResult multimodal) {
        if (multimodal.extraction() == null && multimodal.planning() == null) {
            return null;
        }
        Map<String, Object> payload = new HashMap<>();
        if (multimodal.extraction() != null) {
            payload.put("extraction", multimodal.extraction());
        }
        if (multimodal.planning() != null) {
            payload.put("planning", multimodal.planning());
        }
        if (payload.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    private static List<TopicChoiceItem> toTopicChoiceItems(List<TopicMemory> topics) {
        if (topics == null) {
            return List.of();
        }
        List<TopicChoiceItem> items = new ArrayList<>(topics.size());
        for (TopicMemory t : topics) {
            items.add(new TopicChoiceItem(t.getTopicId(), t.getDisplayTitle()));
        }
        return items;
    }

    private static TopicMemory findTopicById(ConversationState state, String topicId) {
        if (state == null || topicId == null) {
            return null;
        }
        return state.getTopics().stream()
                .filter(t -> topicId.equals(t.getTopicId()))
                .findFirst()
                .orElse(null);
    }

    private static ChatCompletionsRequest newCompletionsRequest(String chatKey,
                                                                String rawUserMessage,
                                                                String llmUserMessage,
                                                                String ragQuery) {
        ChatCompletionsRequest req = new ChatCompletionsRequest();
        req.setChatId(chatKey);
        req.setOriginalUserMessage(rawUserMessage);

        Map<String, Object> userMsg = new HashMap<>(2);
        userMsg.put("role", "user");
        userMsg.put("content", llmUserMessage != null ? llmUserMessage : "");
        req.setMessages(new ArrayList<>(List.of(userMsg)));

        req.setRagQuery(ragQuery);
        return req;
    }
}
