package org.verdikt.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.verdikt.chat.dto.ChooseTopicResponse;
import org.verdikt.chat.dto.TopicChoiceItem;
import org.verdikt.chat.model.ConversationState;
import org.verdikt.chat.model.TopicMemory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.verdikt.dto.ChatCompletionsRequest;
import org.verdikt.dto.VerdiktModelType;
import org.verdikt.dto.multimodal.ConversationAnalysisItem;
import org.verdikt.dto.multimodal.InteractionAnalysisResult;
import org.verdikt.dto.multimodal.MultimodalAnalysisPlanResult;
import org.verdikt.dto.multimodal.MultimodalResult;
import org.verdikt.dto.multimodal.QueryPlanningResult;
import org.verdikt.dto.multimodal.RetrievalQuery;
import org.verdikt.entity.Chat;
import org.verdikt.entity.User;
import org.verdikt.repository.ChatRepository;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Orchestrates the chat turn pipeline: topic routing, optional multimodal preprocessing, rewrite, then
 * a {@link ChatCompletionsRequest} for streaming. Does not call the main LLM itself.
 */
@Service
public class ChatOrchestratorService {

    private static final Logger log = LoggerFactory.getLogger(ChatOrchestratorService.class);

    private static final int USER_CONTEXT_MESSAGE_WINDOW = 10;

    private final ChatRepository chatRepository;
    private final ChatHistoryService chatHistoryService;
    private final ChatTurnProcessor chatTurnProcessor;
    private final RewriteService rewriteService;
    private final TopicMemoryService topicMemoryService;
    private final MemoryUpdateService memoryUpdateService;
    private final MultimodalPreprocessingService multimodalPreprocessingService;
    private final RagQueryRewriteService ragQueryRewriteService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ChatOrchestratorService(ChatRepository chatRepository,
                                 ChatHistoryService chatHistoryService,
                                 ChatTurnProcessor chatTurnProcessor,
                                 RewriteService rewriteService,
                                 TopicMemoryService topicMemoryService,
                                 MemoryUpdateService memoryUpdateService,
                                 MultimodalPreprocessingService multimodalPreprocessingService,
                                 RagQueryRewriteService ragQueryRewriteService) {
        this.chatRepository = chatRepository;
        this.chatHistoryService = chatHistoryService;
        this.chatTurnProcessor = chatTurnProcessor;
        this.rewriteService = rewriteService;
        this.topicMemoryService = topicMemoryService;
        this.memoryUpdateService = memoryUpdateService;
        this.multimodalPreprocessingService = multimodalPreprocessingService;
        this.ragQueryRewriteService = ragQueryRewriteService;
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
                                          List<String> imageIds,
                                          VerdiktModelType modelType) {
        requireNonBlankMessage(message);

        VerdiktModelType mt = modelType != null ? modelType : VerdiktModelType.VERDIKT_CHAT;

        String effectiveChatKey = resolveChatKey(chatKey);
        Chat chat = loadOrCreateChatPlaceholder(user, effectiveChatKey);
        ConversationState state = chatHistoryService.parseConversationState(chat);

        TurnDecision decision = chatTurnProcessor.decide(state, message, selectedTopicId);

        return switch (decision.getType()) {
            case ASK_USER_TO_CHOOSE -> askUserToChooseTopic(user, effectiveChatKey, message, imageIds, decision);
            case FIRST_MESSAGE -> streamNewConversation(user, effectiveChatKey, message, imageIds, state, mt);
            case USE_TOPIC -> streamWithExistingTopic(
                    user, effectiveChatKey, message, imageIds, selectedTopicId, state, decision.getTopic(), mt);
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
        String multimodalMemorySummary = buildMultimodalMemorySummary(stream.request().getImageAnalysis());
        if (state.getTopics().isEmpty()) {
            initializeTopicAfterFirstStream(stream, state, rawUserMessage, assistantText, ragItemIds, multimodalMemorySummary);
        } else {
            updateTopicAfterStream(stream, state, rawUserMessage, assistantText, ragItemIds, multimodalMemorySummary);
        }
        return state;
    }

    /**
     * Краткий нейтральный контекст для обновления памяти: только поля extraction (без stage-2 интерпретаций).
     */
    private String buildMultimodalMemorySummary(String imageAnalysisJson) {
        if (imageAnalysisJson == null || imageAnalysisJson.isBlank()) {
            return "";
        }
        try {
            JsonNode root = objectMapper.readTree(imageAnalysisJson);

            // Собираем intent_summary из каждой переписки в analysis_plan
            JsonNode analyses = root.path("analysis_plan").path("conversation_analyses");

            if (analyses.isArray() && !analyses.isEmpty()) {
                List<String> summaries = new ArrayList<>();
                for (JsonNode conv : analyses) {
                    String convId = jsonText(conv, "conversation_id");
                    String intentSummary = jsonText(conv, "intent_summary");
                    if (!intentSummary.isEmpty()) {
                        String prefix = !convId.isEmpty() ? "[" + convId + "] " : "";
                        summaries.add(prefix + intentSummary);
                    }
                }
                if (!summaries.isEmpty()) {
                    String joined = String.join(" | ", summaries);
                    if (joined.length() > 650) {
                        joined = joined.substring(0, 647) + "...";
                    }
                    return joined;
                }
            }

            // Фоллбэк: planning.intent_summary если analysis_plan пустой
            String planningIntent = jsonText(root.path("planning"), "intent_summary");
            if (!planningIntent.isEmpty()) {
                return planningIntent.length() > 650
                        ? planningIntent.substring(0, 647) + "..."
                        : planningIntent;
            }

            return "";
        } catch (Exception ignored) {
            return "";
        }
    }

    private static String jsonText(JsonNode node, String field) {
        if (node == null || !node.isObject()) {
            return "";
        }
        JsonNode v = node.get(field);
        return v != null && v.isTextual() ? v.asText().trim() : "";
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
                                                     ConversationState state,
                                                     VerdiktModelType modelType) {
        boolean hasImages = !normalizeImageIds(imageIds).isEmpty();
        VerdiktModelType mt = effectiveModelType(modelType, hasImages);

        String effectiveQuery = message;
        String ragQueryForRetrieval = message;
        String rewriterJson = null;
        List<String> ragQueriesFromRewriter = null;
        String ragRewriterPlanType = null;

        // С картинками эффективный тип — reasoner, rewriter не вызывается (multimodal RAG).
        // Без картинок: chat — сырой текст; auto/reasoner — RagQueryRewriteService как на следующих ходах.
        if (!hasImages && mt.usesLlmRagQueryRewriter()) {
            try {
                RagQueryRewriteService.RagRewriteResult rr = ragQueryRewriteService.rewriteUserMessage(
                        message,
                        List.of(),
                        "",
                        "");
                ragRewriterPlanType = rr.planType();
                rewriterJson = rr.rawJson();
                List<String> qs = rr.queries();
                if (qs != null && !qs.isEmpty()) {
                    ragQueriesFromRewriter = qs;
                    ragQueryForRetrieval = qs.get(0);
                    effectiveQuery = String.join("\n", qs);
                }
            } catch (Exception e) {
                log.warn("RAG query rewriter failed on first message, falling back to user text: {}", e.getMessage());
                rewriterJson = null;
            }
        }

        ChatCompletionsRequest request = newCompletionsRequest(chatKey, message, message, ragQueryForRetrieval);
        if (ragQueriesFromRewriter != null) {
            request.setRagQueries(ragQueriesFromRewriter);
        }
        if (!hasImages && mt.usesLlmRagQueryRewriter() && rewriterJson != null && !rewriterJson.isBlank()) {
            request.setRagRetrievalRewriteJson(rewriterJson);
        }
        request.setVerdiktModelType(mt);
        applyAnswerMaxTokens(request, ragRewriterPlanType);
        attachMultimodal(user, message, imageIds, request);
        state.setTurnCounter(0);
        return new OrchestratorResult.Stream(request, state, message, effectiveQuery, false);
    }

    private OrchestratorResult streamWithExistingTopic(User user,
                                                         String chatKey,
                                                         String message,
                                                         List<String> imageIds,
                                                         String selectedTopicId,
                                                         ConversationState state,
                                                         TopicMemory topic,
                                                         VerdiktModelType modelType) {
        boolean hasImages = !normalizeImageIds(imageIds).isEmpty();
        VerdiktModelType mt = effectiveModelType(modelType, hasImages);
        String contextForLlm = chatHistoryService.buildLastUserMessagesContext(
                user, chatKey, message, USER_CONTEXT_MESSAGE_WINDOW);

        String effectiveRewrite;
        String ragQueryForRetrieval;
        String rewriterJson = null;
        List<String> ragQueriesFromRewriter = null;
        String ragRewriterPlanType = null;

        if (hasImages) {
            // С картинками RAG-запросы задаёт multimodal; RewriteService / RagQueryRewriteService не вызываем.
            ragQueryForRetrieval = message;
            effectiveRewrite = message;
        } else if (mt == VerdiktModelType.VERDIKT_CHAT) {
            String rewrite = rewriteService.rewrite(topic, message);
            effectiveRewrite = (rewrite != null && !rewrite.isBlank()) ? rewrite : message;
            ragQueryForRetrieval = effectiveRewrite;
        } else if (mt.usesLlmRagQueryRewriter()) {
            try {
                List<String> memFacts = topic.getFactsFromUser() != null ? topic.getFactsFromUser() : List.of();
                RagQueryRewriteService.RagRewriteResult rr = ragQueryRewriteService.rewriteUserMessage(
                        message,
                        memFacts,
                        nullToEmpty(topic.getLastRewrite()),
                        nullToEmpty(topic.getLastRagRetrievalQueries()));
                ragRewriterPlanType = rr.planType();
                rewriterJson = rr.rawJson();
                List<String> qs = rr.queries();
                if (qs != null && !qs.isEmpty()) {
                    ragQueriesFromRewriter = qs;
                    ragQueryForRetrieval = qs.get(0);
                    effectiveRewrite = String.join("\n", qs);
                } else {
                    ragQueryForRetrieval = message;
                    effectiveRewrite = message;
                }
            } catch (Exception e) {
                log.warn("RAG query rewriter failed, falling back to user message: {}", e.getMessage());
                ragQueryForRetrieval = message;
                effectiveRewrite = message;
                rewriterJson = null;
            }
        } else {
            ragQueryForRetrieval = message;
            effectiveRewrite = message;
        }

        ChatCompletionsRequest request = newCompletionsRequest(chatKey, message, contextForLlm, ragQueryForRetrieval);
        if (ragQueriesFromRewriter != null) {
            request.setRagQueries(ragQueriesFromRewriter);
        }
        if (!hasImages && mt.usesLlmRagQueryRewriter() && rewriterJson != null && !rewriterJson.isBlank()) {
            request.setRagRetrievalRewriteJson(rewriterJson);
        }
        request.setVerdiktModelType(mt);
        applyAnswerMaxTokens(request, ragRewriterPlanType);

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
                                                 List<Long> ragItemIds,
                                                 String multimodalMemorySummary) {
        String ragQuery = stream.request().getRagQueries() != null && !stream.request().getRagQueries().isEmpty() ?
                stream.request()
                        .getRagQueries()
                        .stream()
                        .map(Object::toString) // если уже String, можно убрать
                        .collect(Collectors.joining("\n")) : stream.request().getRagQuery();
        String effectiveQuery = ragQuery != null ? ragQuery : rawUserMessage;

        chatTurnProcessor.initializeFirstTopic(state, rawUserMessage, effectiveQuery, ragItemIds);

        TopicMemory topic = state.getTopics().isEmpty() ? null : state.getTopics().get(0);
        if (topic != null) {
            applyMemoryUpdate(topic, rawUserMessage, assistantText, multimodalMemorySummary);
        }
    }

    private void updateTopicAfterStream(OrchestratorResult.Stream stream,
                                        ConversationState state,
                                        String rawUserMessage,
                                        String assistantText,
                                        List<Long> ragItemIds,
                                        String multimodalMemorySummary) {
        int nextTurn = state.getTurnCounter() + 1;

        TopicMemory topic = findTopicById(state, state.getActiveTopicId());
        if (topic != null) {
            String rewrite = stream.effectiveQuery();
            if (rewrite == null) {
                rewrite = rawUserMessage;
            }
            applyMemoryUpdate(topic, rawUserMessage, assistantText, multimodalMemorySummary);
            topicMemoryService.updateTopic(
                    topic,
                    rawUserMessage,
                    rewrite,
                    joinRagQueriesFromRequest(stream.request()),
                    topic.getAssistantReferenceSummary(),
                    ragItemIds,
                    nextTurn);
        }
        state.setTurnCounter(nextTurn);
    }

    private void applyMemoryUpdate(TopicMemory topic,
                                   String rawUserMessage,
                                   String assistantText,
                                   String multimodalMemorySummary) {
        var update = memoryUpdateService.buildUpdate(
                topic.getTopicLabel(),
                topic.getDisplayTitle(),
                topic.getUserGoal(),
                topic.getFactsFromUser(),
                rawUserMessage,
                assistantText,
                multimodalMemorySummary);
        memoryUpdateService.applyToTopic(topic, update);
    }

    // --- small helpers ---

    private static void requireNonBlankMessage(String message) {
        if (message == null || message.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Сообщение не может быть пустым");
        }
    }

    private static String nullToEmpty(String s) {
        return s != null ? s : "";
    }

    /** Текст запросов к RAG из request (как в enrichWithRagContext). */
    private static String joinRagQueriesFromRequest(ChatCompletionsRequest req) {
        if (req == null) {
            return "";
        }
        List<String> list = req.getRagQueries();
        if (list != null && !list.isEmpty()) {
            return list.stream()
                    .filter(q -> q != null && !q.isBlank())
                    .map(String::trim)
                    .collect(Collectors.joining("\n"));
        }
        String q = req.getRagQuery();
        return q != null ? q.trim() : "";
    }

    /**
     * С прикреплёнными изображениями режим всегда {@link VerdiktModelType#VERDIKT_REASONER}.
     */
    private static VerdiktModelType effectiveModelType(VerdiktModelType modelType, boolean hasImages) {
        VerdiktModelType mt = modelType != null ? modelType : VerdiktModelType.VERDIKT_CHAT;
        return hasImages ? VerdiktModelType.VERDIKT_REASONER : mt;
    }

    /**
     * Лимит токенов финального ответа основной LLM: {@code type: "multi"} у RAG rewriter или выбран {@link VerdiktModelType#VERDIKT_REASONER} → 3000, иначе 1500.
     */
    private static void applyAnswerMaxTokens(ChatCompletionsRequest request, String ragRewriterPlanType) {
        if (request == null) {
            return;
        }
        boolean multi = ragRewriterPlanType != null && "multi".equalsIgnoreCase(ragRewriterPlanType.trim());
        VerdiktModelType mt = request.getVerdiktModelType();
        boolean reasoner = mt == VerdiktModelType.VERDIKT_REASONER;
        request.setMaxTokens((multi || reasoner) ? 3000 : 1500);
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
        if (multimodal.extraction() == null && multimodal.analysisPlan() == null) {
            return null;
        }
        Map<String, Object> payload = new HashMap<>();
        if (multimodal.extraction() != null) {
            payload.put("extraction", multimodal.extraction());
        }
        MultimodalAnalysisPlanResult plan = multimodal.analysisPlan();
        if (plan != null) {
            payload.put("analysis_plan", plan);
            payload.put("interaction", sliceInteraction(plan));
            payload.put("planning", slicePlanning(plan, multimodal.queries()));
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

    private static ConversationAnalysisItem firstConversationBlock(MultimodalAnalysisPlanResult p) {
        if (p == null || p.conversationAnalyses() == null || p.conversationAnalyses().isEmpty()) {
            return null;
        }
        return p.conversationAnalyses().get(0);
    }

    private static InteractionAnalysisResult sliceInteraction(MultimodalAnalysisPlanResult p) {
        String schema = p != null && p.schemaVersion() != null && !p.schemaVersion().isBlank() ? p.schemaVersion() : "2.1";
        ConversationAnalysisItem b = firstConversationBlock(p);
        if (b == null) {
            return new InteractionAnalysisResult(schema, null, null, List.of(), null);
        }
        return new InteractionAnalysisResult(
                schema,
                b.participantUser(),
                b.participantWoman(),
                b.interactionFeatures(),
                b.conversationDynamics());
    }

    private static QueryPlanningResult slicePlanning(MultimodalAnalysisPlanResult p, List<RetrievalQuery> queries) {
        String schema = p != null && p.schemaVersion() != null && !p.schemaVersion().isBlank() ? p.schemaVersion() : "2.1";
        ConversationAnalysisItem b = firstConversationBlock(p);
        List<RetrievalQuery> merged = queries != null && !queries.isEmpty()
                ? queries
                : (b != null && b.retrievalQueries() != null ? b.retrievalQueries() : List.of());
        if (b == null) {
            return new QueryPlanningResult(schema, "", List.of(), List.of(), merged != null ? merged : List.of());
        }
        return new QueryPlanningResult(
                schema,
                b.intentSummary(),
                b.messageAnnotations(),
                b.conversationHypotheses(),
                merged != null ? merged : List.of());
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
