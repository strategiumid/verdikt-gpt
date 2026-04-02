package org.verdikt.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.verdikt.dto.multimodal.ConversationAnalysisItem;
import org.verdikt.dto.multimodal.ConversationDynamics;
import org.verdikt.dto.multimodal.ConversationHypothesis;
import org.verdikt.dto.multimodal.ExtractionQuality;
import org.verdikt.dto.multimodal.ExtractedConversation;
import org.verdikt.dto.multimodal.ExtractedMessage;
import org.verdikt.dto.multimodal.InteractionAnalysisResult;
import org.verdikt.dto.multimodal.InteractionFeatureItem;
import org.verdikt.dto.multimodal.MessageAnnotation;
import org.verdikt.dto.multimodal.MultimodalAnalysisPlanResult;
import org.verdikt.dto.multimodal.ParticipantSideMetrics;
import org.verdikt.dto.multimodal.MultimodalResult;
import org.verdikt.dto.multimodal.QueryPlanningResult;
import org.verdikt.dto.multimodal.RetrievalQuery;
import org.verdikt.dto.multimodal.ToneHypothesis;
import org.verdikt.dto.multimodal.VisionExtractionResult;
import org.verdikt.entity.User;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class MultimodalPreprocessingService {

    private static final Logger log = LoggerFactory.getLogger(MultimodalPreprocessingService.class);

    private static final int MAX_QUERY_LENGTH = 180;

    private static final int EXTRACTION_MAX_TOKENS = 6000;
    private static final int STAGE2_ANALYSIS_MAX_TOKENS = 5600;
    private static final int STAGE2_ANALYSIS_RETRY_MAX_TOKENS = 6800;

    private static final int MAX_EVIDENCE_STRINGS = 2;
    private static final int MAX_EVIDENCE_MESSAGE_IDS = 2;
    private static final int MAX_INTERACTION_FEATURES = 8;
    private static final int MAX_CONVERSATION_HYPOTHESES = 4;
    private static final int MAX_RETRIEVAL_QUERIES = 4;
    /** Сжатый контекст для stage 2: меньше токенов, без полного visible_facts. */
    private static final int STAGE2_MAX_MESSAGES = 50;
    private static final int STAGE2_MAX_MISSING_CONTEXT_LINES = 8;

    /** Текст user-сообщения для vision-API: без вопроса пользователя, только контекст картинок. */
    private static final String VISION_EXTRACTION_USER_MESSAGE = """
            Ниже приложены изображения скриншотов переписки. Верни один JSON-объект строго по схеме из system-сообщения, без markdown.""";

    private static final String VISION_EXTRACTION_PROMPT = """
            Ты — технический парсер скриншотов переписки. Ты НЕ психолог, НЕ советчик, НЕ интерпретируешь интерес, дистанцию или мотивы.
            Не додумывай скрытые сообщения и не восстанавливай обрезанный текст.
                        
            ЗАПРЕЩЕНО в текстах, visible_facts и полях сообщений использовать интерпретации вроде:
            «холодная», «заинтересована», «теряет интерес», «игнорирует», «проверяет», «отталкивает», «манипулирует» и т.п.
            Только то, что можно проверить глазами на изображении.
                        
            Задача этапа — только факты: OCR + разметка. Одно логическое сообщение = одна запись в messages. Не сливай несколько реплик в одну.
            Сохраняй орфографию в text как на скрине. Элементы интерфейса не считай сообщениями, если это не пузырь/реплика чата.
                        
            Для каждого изображения определи видимый заголовок чата в верхней части UI (имя собеседницы / название чата), если читается.
            conversations[]: по одному объекту на каждый скрин (свой image_index). Несколько скринов ОДНОГО И ТОГО ЖЕ чата должны использовать ОДИН И ТОТ ЖЕ conversation_id (повтори тот же id с разными image_index) — так downstream поймёт, что это один диалог, а не разные переписки.
            Если скрины из разных чатов — разные conversation_id.
            Поля chat_title и other_participant_label — как на скрине; если не читается уверенно — null.
                        
            Каждое сообщение: conversation_id из того чата, к которому относится скрин этого сообщения.
            sender: user|woman|unknown.
            sender_confidence: 0.0–1.0 — уверенность в том, кто отправитель (по пузырю/стороне/подписи); не смешивай с OCR.
            sender_label — для woman, если подпись видна уверенно; иначе null.
            text_confidence: 0.0–1.0 — только уверенность в прочтении текста в пузыре (OCR), не зависит от sender.
            timestamp_text: время/дата у сообщения, если видны в UI рядом с пузырём; иначе null. Не выдумывай.
                        
            Верни только JSON (без markdown, без текста вне JSON):
                        
            {
              "schema_version": "2.1",
              "conversations": [
                {
                  "conversation_id": "c1",
                  "image_index": 0,
                  "chat_title": "string|null",
                  "other_participant_label": "string|null"
                }
              ],
              "messages": [
                {
                  "message_id": "m1",
                  "global_order": 0,
                  "image_index": 0,
                  "order_in_image": 0,
                  "conversation_id": "c1",
                  "sender": "user|woman|unknown",
                  "sender_confidence": 0.0,
                  "sender_label": "string|null",
                  "replies_to_visible_message_id": "string|null",
                  "text": "string",
                  "text_confidence": 0.0,
                  "timestamp_text": "string|null",
                  "is_partial": false,
                  "has_unreadable_fragment": false
                }
              ],
              "visible_facts": ["string — только проверяемые наблюдения с экрана"],
              "missing_context": ["string — чего не видно на скринах"],
              "extraction_quality": {
                "label": "high|medium|low",
                "reasons": ["string"]
              }
            }
                        
            Эмодзи и UI-элементы (строгое правило):
            - В text попадают ТОЛЬКО символы ВНУТРИ пузыря сообщения.
            - Всё вне пузыря (реакции Telegram, эмодзи под сообщением, плашки, иконки, аватары, декор) — полностью игнорируй: не в text, не отдельные записи в messages.
            - is_partial / has_unreadable_fragment — если текст в пузыре читается неуверенно; не угадывай слова.
                        
            Правила:
            - global_order: сквозной порядок (0,1,2,…) по чтению переписки на всех скринах.
            - messages: сверху вниз; image_index = индекс картинки во входном наборе (0..N-1).
            - Дедуп при пролистывании: если одна и та же реплика (тот же текст и тот же отправитель) видна на двух соседних скринах на стыке — включи её один раз в messages, не дублируй.
            - Не объединяй разные реплики в одну запись.
            - replies_to_visible_message_id только при явной визуальной связи «ответ на …».
            - Если sender неочевиден — sender=unknown и снижай sender_confidence; плохой OCR текста — снижай text_confidence (это разные шкалы).
            - Если сообщений нет — messages: [] и причина в missing_context.
            - Не добавляй поле user_text.
            """;

    /**
     * Один текстовый вызов: паттерны взаимодействия + интерпретация + RAG-запросы по JSON извлечения и вопросу пользователя.
     */
    private static final String ANALYSIS_AND_PLANNING_PROMPT = """
            Ты анализируешь переписки по УЖЕ извлечённому extraction_result (факты с экрана) и отвечаешь на user_text.
            Ты не психолог и не выносишь диагнозов. Не используй токсичные или обвиняющие ярлыки.
                        
            Вход — один JSON:
            - user_text — что хочет пользователь (сравнить чаты, интерес, совет и т.д.)
            - extraction_result — сжатое извлечение: conversations, messages (лимит), extraction_quality, missing_context, total_message_count.
                        
            Выход — отдельный полный анализ для КАЖДОГО логического conversation_id из extraction (каждая переписка — свой объект в conversation_analyses).
            Не смешивай message_id, evidence и гипотезы между разными conversation_id.
            Если user_text про одну девушку/один чат — всё равно заполни блок для каждого conversation_id, релевантный ответ отрази в intent_summary внутри нужного блока.
                        
            Для каждой переписки порядок работы:
            1) Сначала 1–2 главных interaction_features по сообщениям ТОЛЬКО этого conversation_id.
            2) Затем одна главная conversation_hypothesis (остальные вторичны).
            3) Затем retrieval_queries — из этих главных паттернов/гипотезы (не 4 слабых сигнала).
                        
            Противоречивые сигналы внутри одного чата: не выбирай один полюс насильно; mixed_signals, mixed_interest, dry_communication, unclear. Не «разруливай» двусмысленность за счёт эмоционального user_text.
                        
            Короткая выборка (только сообщения этого conversation_id): если < 4 — сильные жёсткие labels в interaction_features не использовать (кроме unclear, mixed_signals, dry_communication и близких). При 1–2 сообщениях max confidence гипотез ~0.55; при 3 — осторожнее.
                        
            Учитывай text_confidence, sender_confidence, is_partial, has_unreadable_fragment, extraction_quality — при плохом OCR или sender=unknown не завышай confidence интерпретации.
            timestamp_text — для delayed_responsiveness только если время есть в данных.
                        
            Верни один JSON (без markdown):
                        
            {
              "schema_version": "2.1",
              "conversation_analyses": [
                {
                  "conversation_id": "c1",
                  "intent_summary": "string — что важно для user_text именно по этому чату",
                  "participant_user": {
                    "initiative_level": "low|medium|high|unclear",
                    "effort_level": "low|medium|high|unclear",
                    "reciprocity_level": "low|medium|high|unclear",
                    "questioning_level": "low|medium|high|unclear",
                    "topic_advancement_level": "low|medium|high|unclear"
                  },
                  "participant_woman": {
                    "initiative_level": "low|medium|high|unclear",
                    "effort_level": "low|medium|high|unclear",
                    "reciprocity_level": "low|medium|high|unclear",
                    "questioning_level": "low|medium|high|unclear",
                    "topic_advancement_level": "low|medium|high|unclear"
                  },
                  "interaction_features": [
                    {
                      "label": "short_replies|initiative_imbalance|initiative_without_reciprocity|minimal_acknowledgment_pattern|low_reciprocity|low_question_reciprocity|effort_asymmetry|topic_closure|topic_maintenance_asymmetry|question_avoidance|answer_without_expansion|delayed_responsiveness|warmth_asymmetry|reactive_participation|mixed_signals|other",
                      "applies_to": "user|woman|conversation|unclear",
                      "confidence": 0.0,
                      "evidence_message_ids": ["message_id только этого чата"]
                    }
                  ],
                  "conversation_dynamics": {
                    "initiative_balance": "user_dominant|balanced|woman_dominant|unclear",
                    "engagement_balance": "user_heavier|balanced|woman_heavier|unclear",
                    "warmth_balance": "user_warmer|balanced|woman_warmer|unclear",
                    "responsiveness_pattern": "engaged|mixed|dry|unclear",
                    "trajectory": "warming|stable|cooling|mixed|unclear"
                  },
                  "message_annotations": [
                    {
                      "message_id": "string",
                      "tone_hypothesis": {
                        "label": "neutral|warm|cold|flirty|ignoring|rejecting|testing|unclear",
                        "confidence": 0.0,
                        "evidence": ["макс. 2 коротких пункта"]
                      },
                      "interaction_role": "initiative|response|question|answer|acknowledgment|topic_shift|topic_close|avoidance|unclear",
                      "effort_signal": "high|medium|low|unclear",
                      "reciprocity_signal": "high|medium|low|unclear"
                    }
                  ],
                  "conversation_hypotheses": [
                    {
                      "label": "low_engagement|one_sided_investment|mixed_interest|dry_communication|polite_distance|balanced_interest|reactive_communication|uneven_reciprocity|unclear|other",
                      "confidence": 0.0,
                      "evidence": ["макс. 2 пункта"]
                    }
                  ],
                  "retrieval_queries": [
                    {
                      "type": "primary|interpretation|action|lexical",
                      "text": "string",
                      "confidence": 0.0
                    }
                  ]
                }
              ]
            }
            """;

    private final LlmProxyService llmProxyService;
    private final ImageAttachmentService imageAttachmentService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String debugPlanningPath;
    private final String multimodalVisionModel;

    public MultimodalPreprocessingService(LlmProxyService llmProxyService,
                                        ImageAttachmentService imageAttachmentService,
                                        @Value("${debug.multimodal-planning-path:src/main/resources/debug/multimodal-planning.json}") String debugPlanningPath,
                                        @Value("${llm.multimodal.vision_model:google/gemini-3.1-pro-preview}") String multimodalVisionModel) {
        this.llmProxyService = llmProxyService;
        this.imageAttachmentService = imageAttachmentService;
        this.debugPlanningPath = debugPlanningPath;
        this.multimodalVisionModel = multimodalVisionModel;
    }

    /** Сырой ответ объединённого текстового этапа и ошибка при сбое. */
    private record Stage2PlanResult(
            MultimodalAnalysisPlanResult result,
            String rawResponse,
            String failureSummary
    ) {}

    public MultimodalResult buildQueries(User user, String userText, List<String> imageIds) {
        if (imageIds == null || imageIds.isEmpty()) {
            return new MultimodalResult(List.of(), null, null);
        }

        List<String> dataUrls = new ArrayList<>();
        int totalImages = Math.min(imageIds.size(), 10);
        for (int i = 0; i < totalImages; i++) {
            dataUrls.add(imageAttachmentService.loadOwnedImageAsDataUrl(user, imageIds.get(i)));
        }

        final String extractionJsonRaw;
        try {
            extractionJsonRaw = llmProxyService.completeMultimodalJson(
                    VISION_EXTRACTION_PROMPT,
                    VISION_EXTRACTION_USER_MESSAGE,
                    dataUrls,
                    0.2,
                    EXTRACTION_MAX_TOKENS,
                    multimodalVisionModel
            );
        } catch (Exception e) {
            log.warn("Multimodal stage1 (vision) failed: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Сервис анализа изображений временно недоступен", e);
        }

        int maxImageIndex = Math.max(0, totalImages - 1);
        VisionExtractionResult extraction = parseExtraction(extractionJsonRaw, maxImageIndex);

        Stage2PlanResult stage2 = runAnalysisPlanningStage(userText, extraction);

        if (stage2.result() == null) {
            List<RetrievalQuery> fallback = fallbackQueries(userText);
            return new MultimodalResult(fallback, extraction, null);
        }

        try {
            MultimodalAnalysisPlanResult normalized = normalizeAnalysisPlan(stage2.result(), extraction);
            List<RetrievalQuery> queries = sanitizeQueries(collectAllRetrievalQueries(normalized), userText);
            return new MultimodalResult(queries, extraction, normalized);
        } catch (Exception e) {
            log.warn("Multimodal stage2 normalize failed: {}", e.getMessage());
            List<RetrievalQuery> fallback = fallbackQueries(userText);
            return new MultimodalResult(fallback, extraction, null);
        }
    }

    private Stage2PlanResult runAnalysisPlanningStage(String userText, VisionExtractionResult extraction) {
        LinkedHashMap<String, Object> payload = new LinkedHashMap<>();
        payload.put("user_text", safe(userText));
        payload.put("extraction_result", buildCompactExtractionForStage2(extraction));
        String inputJson = toJson(payload);
        String raw = null;
        try {
            raw = fetchAnalysisPlanningJson(inputJson);
            MultimodalAnalysisPlanResult parsed = parseStage2Response(raw);
            return new Stage2PlanResult(parsed, raw, null);
        } catch (Exception e) {
            log.warn("Multimodal stage2 (analysis+planning) failed: {} — rawLength={}",
                    e.getMessage(), raw != null ? raw.length() : 0, e);
            persistStage2FailureSidecar(toJson(extraction), raw, e);
            String summary = e.getClass().getSimpleName() + ": " + safe(e.getMessage());
            return new Stage2PlanResult(null, raw != null ? raw : "", summary);
        }
    }

    private MultimodalAnalysisPlanResult normalizeAnalysisPlan(MultimodalAnalysisPlanResult raw, VisionExtractionResult extraction) {
        if (raw == null) {
            return null;
        }
        Set<String> validConvIds = nullSafe(extraction.conversations()).stream()
                .filter(Objects::nonNull)
                .map(ExtractedConversation::conversationId)
                .filter(id -> id != null && !id.isBlank())
                .map(String::trim)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        String inferredSingle = inferSingleConversationId(extraction);
        String schema = safe(raw.schemaVersion()).isBlank() ? "2.1" : raw.schemaVersion().trim();

        List<ConversationAnalysisItem> blocks = new ArrayList<>();
        for (ConversationAnalysisItem block : nullSafe(raw.conversationAnalyses())) {
            if (block == null) {
                continue;
            }
            String cid = trimToNull(block.conversationId());
            if (cid == null) {
                cid = inferredSingle;
            }
            if (cid != null && !validConvIds.contains(cid)) {
                cid = null;
            }
            if (cid == null) {
                log.warn("Multimodal stage2: dropping analysis block with unknown or missing conversation_id");
                continue;
            }
            VisionExtractionResult slice = sliceExtractionByConversationId(extraction, cid);
            InteractionAnalysisResult ia = normalizeInteraction(
                    new InteractionAnalysisResult(
                            schema,
                            block.participantUser(),
                            block.participantWoman(),
                            block.interactionFeatures(),
                            block.conversationDynamics()),
                    slice);
            QueryPlanningResult qp = normalizePlanning(
                    new QueryPlanningResult(
                            schema,
                            block.intentSummary(),
                            block.messageAnnotations(),
                            block.conversationHypotheses(),
                            block.retrievalQueries()),
                    slice);
            ConversationAnalysisItem merged = new ConversationAnalysisItem(
                    cid,
                    safe(qp.intentSummary()),
                    ia.participantUser(),
                    ia.participantWoman(),
                    ia.interactionFeatures(),
                    ia.conversationDynamics(),
                    qp.messageAnnotations(),
                    qp.conversationHypotheses(),
                    qp.retrievalQueries());
            blocks.add(applyShortSampleGuardToBlock(merged, slice));
        }
        if (blocks.isEmpty()) {
            return null;
        }
        return new MultimodalAnalysisPlanResult(schema, blocks);
    }

    /**
     * Ограничивает confidence гипотез при очень малом числе сообщений в данной переписке.
     */
    private ConversationAnalysisItem applyShortSampleGuardToBlock(ConversationAnalysisItem block, VisionExtractionResult slice) {
        int n = nullSafe(slice.messages()).size();
        if (n > 3 || block == null) {
            return block;
        }
        double cap = n <= 2 ? 0.55 : 0.65;
        List<ConversationHypothesis> hy = nullSafe(block.conversationHypotheses()).stream()
                .filter(Objects::nonNull)
                .map(h -> new ConversationHypothesis(
                        h.label(),
                        Math.min(clamp01(h.confidence()), cap),
                        h.evidence()))
                .collect(Collectors.toList());
        return new ConversationAnalysisItem(
                block.conversationId(),
                block.intentSummary(),
                block.participantUser(),
                block.participantWoman(),
                block.interactionFeatures(),
                block.conversationDynamics(),
                block.messageAnnotations(),
                hy,
                block.retrievalQueries());
    }

    private static List<RetrievalQuery> collectAllRetrievalQueries(MultimodalAnalysisPlanResult plan) {
        if (plan == null) {
            return List.of();
        }
        List<RetrievalQuery> all = new ArrayList<>();
        for (ConversationAnalysisItem b : nullSafe(plan.conversationAnalyses())) {
            if (b == null) {
                continue;
            }
            all.addAll(nullSafe(b.retrievalQueries()));
        }
        return all;
    }

    private static String inferSingleConversationId(VisionExtractionResult extraction) {
        if (extraction == null) {
            return null;
        }
        Set<String> ids = nullSafe(extraction.conversations()).stream()
                .filter(Objects::nonNull)
                .map(ExtractedConversation::conversationId)
                .filter(id -> id != null && !id.isBlank())
                .map(String::trim)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        return ids.size() == 1 ? ids.iterator().next() : null;
    }

    private static VisionExtractionResult sliceExtractionByConversationId(VisionExtractionResult extraction, String conversationId) {
        if (extraction == null || conversationId == null || conversationId.isBlank()) {
            return extraction;
        }
        String cid = conversationId.trim();
        List<ExtractedMessage> msgs = nullSafe(extraction.messages()).stream()
                .filter(m -> m != null && cid.equals(safe(m.conversationId()).trim()))
                .collect(Collectors.toList());
        List<ExtractedConversation> convs = nullSafe(extraction.conversations()).stream()
                .filter(c -> c != null && cid.equals(safe(c.conversationId()).trim()))
                .collect(Collectors.toList());
        if (convs.isEmpty() && !msgs.isEmpty()) {
            Integer minImg = msgs.stream()
                    .map(ExtractedMessage::imageIndex)
                    .filter(Objects::nonNull)
                    .findFirst()
                    .orElse(0);
            convs = List.of(new ExtractedConversation(cid, minImg, null, null));
        }
        return new VisionExtractionResult(
                extraction.schemaVersion(),
                extraction.userText(),
                convs.isEmpty() ? extraction.conversations() : convs,
                msgs,
                extraction.visibleFacts(),
                extraction.missingContext(),
                extraction.extractionQuality());
    }

    private MultimodalAnalysisPlanResult parseStage2Response(String raw) throws IOException {
        String payload = extractJsonPayload(raw);
        JsonNode root = objectMapper.readTree(payload);
        if (root.has("conversation_analyses")) {
            return objectMapper.readValue(payload, MultimodalAnalysisPlanResult.class);
        }
        if (root.has("intent_summary") || root.has("participant_user") || root.has("interaction_features")) {
            String schema = root.path("schema_version").asText("2.1");
            String convId = legacyStage2TextOrNull(root.get("target_conversation_id"));
            String intent = root.path("intent_summary").asText("");
            ParticipantSideMetrics pu = convertStage2SubNode(root.get("participant_user"), ParticipantSideMetrics.class);
            ParticipantSideMetrics pw = convertStage2SubNode(root.get("participant_woman"), ParticipantSideMetrics.class);
            List<InteractionFeatureItem> feats = convertStage2List(root.get("interaction_features"), InteractionFeatureItem.class);
            ConversationDynamics dyn = convertStage2SubNode(root.get("conversation_dynamics"), ConversationDynamics.class);
            List<MessageAnnotation> ann = convertStage2List(root.get("message_annotations"), MessageAnnotation.class);
            List<ConversationHypothesis> hyp = convertStage2List(root.get("conversation_hypotheses"), ConversationHypothesis.class);
            List<RetrievalQuery> rq = convertStage2List(root.get("retrieval_queries"), RetrievalQuery.class);
            ConversationAnalysisItem item = new ConversationAnalysisItem(
                    trimToNull(convId),
                    intent,
                    pu,
                    pw,
                    feats,
                    dyn,
                    ann,
                    hyp,
                    rq);
            return new MultimodalAnalysisPlanResult(schema, List.of(item));
        }
        return objectMapper.readValue(payload, MultimodalAnalysisPlanResult.class);
    }

    private static String legacyStage2TextOrNull(JsonNode n) {
        if (n == null || n.isNull()) {
            return null;
        }
        if (!n.isTextual()) {
            return null;
        }
        String t = n.asText().trim();
        return t.isEmpty() ? null : t;
    }

    private <T> T convertStage2SubNode(JsonNode n, Class<T> type) {
        if (n == null || n.isNull()) {
            return null;
        }
        return objectMapper.convertValue(n, type);
    }

    private <T> List<T> convertStage2List(JsonNode n, Class<T> type) {
        if (n == null || !n.isArray()) {
            return List.of();
        }
        List<T> out = new ArrayList<>();
        for (JsonNode x : n) {
            if (x != null && !x.isNull()) {
                out.add(objectMapper.convertValue(x, type));
            }
        }
        return out;
    }

    private Map<String, Object> buildCompactExtractionForStage2(VisionExtractionResult extraction) {
        List<ExtractedMessage> msgs = nullSafe(extraction.messages()).stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(ArrayList::new));
        msgs.sort(Comparator.comparingInt(m -> m.globalOrder() != null ? m.globalOrder() : Integer.MAX_VALUE));
        if (msgs.size() > STAGE2_MAX_MESSAGES) {
            msgs = new ArrayList<>(msgs.subList(0, STAGE2_MAX_MESSAGES));
        }
        List<Map<String, Object>> slim = new ArrayList<>();
        for (ExtractedMessage m : msgs) {
            if (m == null) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("message_id", m.messageId());
            row.put("conversation_id", m.conversationId());
            row.put("sender", m.sender());
            row.put("sender_confidence", m.senderConfidence());
            row.put("sender_label", m.senderLabel());
            row.put("text", m.text());
            row.put("text_confidence", m.textConfidence());
            row.put("timestamp_text", m.timestampText());
            row.put("is_partial", m.isPartial());
            row.put("has_unreadable_fragment", m.hasUnreadableFragment());
            row.put("image_index", m.imageIndex());
            slim.add(row);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("schema_version", extraction.schemaVersion());
        out.put("conversations", nullSafe(extraction.conversations()));
        out.put("messages", slim);
        out.put("extraction_quality", extraction.extractionQuality());
        out.put("missing_context", nullSafe(extraction.missingContext()).stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .limit(STAGE2_MAX_MISSING_CONTEXT_LINES)
                .collect(Collectors.toList()));
        out.put("total_message_count", nullSafe(extraction.messages()).size());
        out.put("note", "Сжатый контекст: первые сообщения по global_order, лимит %d; visible_facts не передаются."
                .formatted(STAGE2_MAX_MESSAGES));
        return out;
    }

    private InteractionAnalysisResult normalizeInteraction(InteractionAnalysisResult raw, VisionExtractionResult extraction) {
        if (raw == null) {
            return null;
        }
        Set<String> allowedIds = messageIds(extraction);
        List<InteractionFeatureItem> features = nullSafe(raw.interactionFeatures()).stream()
                .filter(Objects::nonNull)
                .limit(MAX_INTERACTION_FEATURES)
                .map(f -> new InteractionFeatureItem(
                        normalizeFeatureLabel(f.label()),
                        normalizeAppliesTo(f.appliesTo()),
                        clamp01(f.confidence()),
                        capList(f.evidenceMessageIds(), MAX_EVIDENCE_MESSAGE_IDS, allowedIds)
                ))
                .collect(Collectors.toList());

        return new InteractionAnalysisResult(
                safe(raw.schemaVersion()).isBlank() ? "2.1" : raw.schemaVersion(),
                normalizeParticipantSide(raw.participantUser()),
                normalizeParticipantSide(raw.participantWoman()),
                features,
                normalizeConversationDynamics(raw.conversationDynamics())
        );
    }

    private QueryPlanningResult normalizePlanning(QueryPlanningResult raw, VisionExtractionResult extraction) {
        if (raw == null) {
            return null;
        }
        Set<String> allowedIds = messageIds(extraction);

        List<MessageAnnotation> annotations = nullSafe(raw.messageAnnotations()).stream()
                .filter(Objects::nonNull)
                .filter(a -> a.messageId() != null && allowedIds.contains(a.messageId()))
                .map(this::normalizeAnnotation)
                .collect(Collectors.toList());

        List<ConversationHypothesis> hypotheses = nullSafe(raw.conversationHypotheses()).stream()
                .filter(Objects::nonNull)
                .limit(MAX_CONVERSATION_HYPOTHESES)
                .map(h -> new ConversationHypothesis(
                        normalizeHypothesisLabel(h.label()),
                        clamp01(h.confidence()),
                        capStrings(h.evidence(), MAX_EVIDENCE_STRINGS)
                ))
                .collect(Collectors.toList());

        List<RetrievalQuery> queries = nullSafe(raw.retrievalQueries()).stream()
                .filter(Objects::nonNull)
                .limit(MAX_RETRIEVAL_QUERIES)
                .collect(Collectors.toList());

        return new QueryPlanningResult(
                safe(raw.schemaVersion()).isBlank() ? "2.1" : raw.schemaVersion(),
                safe(raw.intentSummary()),
                annotations,
                hypotheses,
                queries
        );
    }

    private MessageAnnotation normalizeAnnotation(MessageAnnotation a) {
        ToneHypothesis tone = a.toneHypothesis();
        ToneHypothesis toneNorm = tone == null
                ? new ToneHypothesis("unclear", 0.3, List.of())
                : new ToneHypothesis(
                normalizeToneLabel(tone.label()),
                clamp01(tone.confidence()),
                capStrings(tone.evidence(), MAX_EVIDENCE_STRINGS)
        );
        return new MessageAnnotation(
                a.messageId(),
                toneNorm,
                normalizeInteractionRole(a.interactionRole()),
                normalizeEffortSignal(a.effortSignal()),
                normalizeReciprocitySignal(a.reciprocitySignal())
        );
    }

    private static String normalizeToneLabel(String label) {
        String s = safe(label).toLowerCase(Locale.ROOT).trim();
        return switch (s) {
            case "neutral", "warm", "cold", "flirty", "ignoring", "rejecting", "testing", "unclear" -> s;
            default -> "unclear";
        };
    }

    private static String normalizeInteractionRole(String role) {
        String s = safe(role).toLowerCase(Locale.ROOT).trim();
        return switch (s) {
            case "initiative", "response", "question", "answer", "acknowledgment", "topic_shift", "topic_close", "avoidance", "unclear" -> s;
            default -> "unclear";
        };
    }

    private static String normalizeEffortSignal(String effort) {
        String s = safe(effort).toLowerCase(Locale.ROOT).trim();
        return switch (s) {
            case "high", "medium", "low", "unclear" -> s;
            default -> "unclear";
        };
    }

    private static String normalizeReciprocitySignal(String value) {
        String s = safe(value).toLowerCase(Locale.ROOT).trim();
        return switch (s) {
            case "high", "medium", "low", "unclear" -> s;
            default -> "unclear";
        };
    }

    private static String normalizeAppliesTo(String value) {
        String s = safe(value).toLowerCase(Locale.ROOT).trim();
        if ("both".equals(s)) {
            return "conversation";
        }
        return switch (s) {
            case "user", "woman", "conversation", "unclear" -> s;
            default -> "unclear";
        };
    }

    private static String normalizeFeatureLabel(String label) {
        String s = safe(label).toLowerCase(Locale.ROOT).trim();
        return switch (s) {
            case "short_replies", "initiative_imbalance", "initiative_without_reciprocity", "minimal_acknowledgment_pattern",
                 "low_reciprocity", "low_question_reciprocity", "effort_asymmetry", "topic_closure",
                 "topic_maintenance_asymmetry", "question_avoidance", "answer_without_expansion",
                 "delayed_responsiveness", "warmth_asymmetry", "reactive_participation", "mixed_signals", "other" -> s;
            default -> "other";
        };
    }

    private static ConversationDynamics normalizeConversationDynamics(ConversationDynamics d) {
        if (d == null) {
            return null;
        }
        return new ConversationDynamics(
                normalizeInitiativeBalance(d.initiativeBalance()),
                normalizeEngagementBalance(d.engagementBalance()),
                normalizeWarmthBalance(d.warmthBalance()),
                normalizeResponsivenessPattern(d.responsivenessPattern()),
                normalizeTrajectoryLabel(d.trajectory())
        );
    }

    private static String normalizeInitiativeBalance(String value) {
        String s = safe(value).toLowerCase(Locale.ROOT).trim();
        return switch (s) {
            case "user_dominant", "balanced", "woman_dominant", "unclear" -> s;
            default -> "unclear";
        };
    }

    private static String normalizeEngagementBalance(String value) {
        String s = safe(value).toLowerCase(Locale.ROOT).trim();
        return switch (s) {
            case "user_heavier", "balanced", "woman_heavier", "unclear" -> s;
            default -> "unclear";
        };
    }

    private static String normalizeWarmthBalance(String value) {
        String s = safe(value).toLowerCase(Locale.ROOT).trim();
        return switch (s) {
            case "user_warmer", "balanced", "woman_warmer", "unclear" -> s;
            default -> "unclear";
        };
    }

    private static String normalizeResponsivenessPattern(String value) {
        String s = safe(value).toLowerCase(Locale.ROOT).trim();
        return switch (s) {
            case "engaged", "mixed", "dry", "unclear" -> s;
            default -> "unclear";
        };
    }

    private static String normalizeTrajectoryLabel(String value) {
        String s = safe(value).toLowerCase(Locale.ROOT).trim();
        return switch (s) {
            case "warming", "stable", "cooling", "mixed", "unclear" -> s;
            default -> "unclear";
        };
    }

    private static String normalizeHypothesisLabel(String label) {
        String s = safe(label).toLowerCase(Locale.ROOT).trim();
        return switch (s) {
            case "low_engagement", "one_sided_investment", "mixed_interest", "dry_communication",
                 "polite_distance", "balanced_interest", "reactive_communication", "uneven_reciprocity",
                 "unclear", "other" -> s;
            default -> "other";
        };
    }

    private static ParticipantSideMetrics normalizeParticipantSide(ParticipantSideMetrics p) {
        if (p == null) {
            return defaultParticipantSideMetrics();
        }
        return new ParticipantSideMetrics(
                normalizeParticipantLevel(p.initiativeLevel()),
                normalizeParticipantLevel(p.effortLevel()),
                normalizeParticipantLevel(p.reciprocityLevel()),
                normalizeParticipantLevel(p.questioningLevel()),
                normalizeParticipantLevel(p.topicAdvancementLevel())
        );
    }

    private static ParticipantSideMetrics defaultParticipantSideMetrics() {
        return new ParticipantSideMetrics("unclear", "unclear", "unclear", "unclear", "unclear");
    }

    private static String normalizeParticipantLevel(String value) {
        String s = safe(value).toLowerCase(Locale.ROOT).trim();
        return switch (s) {
            case "low", "medium", "high", "unclear" -> s;
            default -> "unclear";
        };
    }

    private static Set<String> messageIds(VisionExtractionResult extraction) {
        Set<String> ids = new HashSet<>();
        if (extraction == null || extraction.messages() == null) {
            return ids;
        }
        for (ExtractedMessage m : extraction.messages()) {
            if (m != null && m.messageId() != null && !m.messageId().isBlank()) {
                ids.add(m.messageId().trim());
            }
        }
        return ids;
    }

    private static List<String> capStrings(List<String> list, int max) {
        if (list == null || list.isEmpty()) {
            return List.of();
        }
        return list.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .limit(max)
                .collect(Collectors.toList());
    }

    private static List<String> capList(List<String> list, int max, Set<String> allowed) {
        if (list == null || list.isEmpty() || allowed.isEmpty()) {
            return List.of();
        }
        return list.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .filter(allowed::contains)
                .distinct()
                .limit(max)
                .collect(Collectors.toList());
    }

    private VisionExtractionResult parseExtraction(String extractionJson, int maxImageIndexInclusive) {
        try {
            VisionExtractionResult parsed = objectMapper.readValue(extractJsonPayload(extractionJson), VisionExtractionResult.class);
            if (parsed == null) {
                throw new IllegalArgumentException("empty extraction");
            }
            return normalizeExtraction(parsed, maxImageIndexInclusive);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception ex) {
            log.warn("Multimodal stage1 extraction JSON invalid: {}", ex.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Некорректный ответ сервиса извлечения (JSON)", ex);
        }
    }

    private VisionExtractionResult normalizeExtraction(VisionExtractionResult parsed, int maxImageIndexInclusive) {
        List<ExtractedConversation> conversations = normalizeConversations(parsed, maxImageIndexInclusive);
        Set<String> validConvIds = conversations.stream()
                .map(ExtractedConversation::conversationId)
                .filter(id -> id != null && !id.isBlank())
                .collect(Collectors.toCollection(HashSet::new));
        Map<Integer, String> imageToConvId = mapImageToPrimaryConversationId(conversations);

        List<ExtractedMessage> raw = nullSafe(parsed.messages());
        LinkedHashSet<String> usedIds = new LinkedHashSet<>();
        List<ExtractedMessage> pass1 = new ArrayList<>();
        int seq = 0;
        for (ExtractedMessage m : raw) {
            if (m == null) {
                continue;
            }
            String id = allocateMessageId(m.messageId(), usedIds, seq);
            pass1.add(normalizeSlimMessage(m, id, seq, maxImageIndexInclusive, validConvIds, imageToConvId));
            seq++;
        }
        Set<String> allIds = pass1.stream().map(ExtractedMessage::messageId).collect(Collectors.toSet());
        List<ExtractedMessage> messages = new ArrayList<>(pass1.size());
        for (ExtractedMessage m : pass1) {
            messages.add(fixReplyTarget(m, allIds));
        }

        List<String> visibleFacts = nullSafe(parsed.visibleFacts()).stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .limit(50)
                .collect(Collectors.toList());
        List<String> missingContext = nullSafe(parsed.missingContext()).stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .limit(50)
                .collect(Collectors.toList());

        ExtractionQuality quality = normalizeExtractionQuality(parsed.extractionQuality());

        return new VisionExtractionResult(
                safe(parsed.schemaVersion()).isBlank() ? "2.1" : parsed.schemaVersion().trim(),
                "",
                conversations,
                messages,
                visibleFacts,
                missingContext,
                quality
        );
    }

    private static List<ExtractedConversation> normalizeConversations(VisionExtractionResult parsed, int maxImageIndexInclusive) {
        Set<String> reservedIds = new HashSet<>();
        for (ExtractedConversation c : nullSafe(parsed.conversations())) {
            if (c != null && c.conversationId() != null && !c.conversationId().isBlank()) {
                reservedIds.add(c.conversationId().trim());
            }
        }
        List<ExtractedConversation> out = new ArrayList<>();
        int autoCounter = 1;
        for (ExtractedConversation c : nullSafe(parsed.conversations())) {
            if (c == null) {
                continue;
            }
            String id = safe(c.conversationId()).trim();
            if (id.isEmpty()) {
                String gen;
                do {
                    gen = "c" + autoCounter++;
                } while (reservedIds.contains(gen));
                reservedIds.add(gen);
                id = gen;
            }
            int img = c.imageIndex() == null ? 0 : c.imageIndex();
            if (maxImageIndexInclusive >= 0) {
                img = Math.max(0, Math.min(img, maxImageIndexInclusive));
            }
            String title = trimToNull(c.chatTitle());
            String label = trimToNull(c.otherParticipantLabel());
            out.add(new ExtractedConversation(id, img, title, label));
        }
        if (out.isEmpty() && maxImageIndexInclusive >= 0) {
            for (int i = 0; i <= maxImageIndexInclusive; i++) {
                out.add(new ExtractedConversation("c" + (i + 1), i, null, null));
            }
        }
        return resolveImageIndexConversationConflicts(out);
    }

    /**
     * Один image_index не должен молча маппиться на разные conversation_id: оставляем первый id по порядку списка, остальные строки сливаем/отбрасываем.
     */
    private static List<ExtractedConversation> resolveImageIndexConversationConflicts(List<ExtractedConversation> conversations) {
        Map<Integer, String> imageToCanonical = new LinkedHashMap<>();
        Map<Integer, Set<String>> imageToIds = new LinkedHashMap<>();
        for (ExtractedConversation c : conversations) {
            if (c == null) {
                continue;
            }
            int img = c.imageIndex() == null ? 0 : c.imageIndex();
            String id = safe(c.conversationId()).trim();
            if (id.isEmpty()) {
                continue;
            }
            imageToIds.computeIfAbsent(img, k -> new LinkedHashSet<>()).add(id);
            imageToCanonical.putIfAbsent(img, id);
        }
        for (Map.Entry<Integer, Set<String>> e : imageToIds.entrySet()) {
            if (e.getValue().size() > 1) {
                log.warn("Multimodal extraction: image_index {} has multiple conversation_ids {}; canonical id {}",
                        e.getKey(), e.getValue(), imageToCanonical.get(e.getKey()));
            }
        }
        Set<String> seenImageCanonical = new LinkedHashSet<>();
        List<ExtractedConversation> rewritten = new ArrayList<>();
        for (ExtractedConversation c : conversations) {
            if (c == null) {
                continue;
            }
            int img = c.imageIndex() == null ? 0 : c.imageIndex();
            String canonical = imageToCanonical.get(img);
            if (canonical == null) {
                String id = safe(c.conversationId()).trim();
                canonical = id.isEmpty() ? null : id;
            }
            if (canonical == null) {
                continue;
            }
            String key = img + "\0" + canonical;
            if (seenImageCanonical.contains(key)) {
                continue;
            }
            seenImageCanonical.add(key);
            rewritten.add(new ExtractedConversation(canonical, c.imageIndex(), c.chatTitle(), c.otherParticipantLabel()));
        }
        return rewritten.isEmpty() ? conversations : rewritten;
    }

    private static Map<Integer, String> mapImageToPrimaryConversationId(List<ExtractedConversation> conversations) {
        Map<Integer, String> map = new HashMap<>();
        for (ExtractedConversation c : conversations) {
            if (c == null || c.imageIndex() == null || c.conversationId() == null) {
                continue;
            }
            map.putIfAbsent(c.imageIndex(), c.conversationId());
        }
        return map;
    }

    private static String trimToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static ExtractedMessage normalizeSlimMessage(ExtractedMessage m,
                                                         String messageId,
                                                         int defaultOrderIndex,
                                                         int maxImageIndexInclusive,
                                                         Set<String> validConvIds,
                                                         Map<Integer, String> imageToConvId) {
        Integer gOrder = m.globalOrder();
        if (gOrder == null || gOrder < 0) {
            gOrder = defaultOrderIndex;
        }
        Integer imgIdx = m.imageIndex();
        if (maxImageIndexInclusive >= 0) {
            if (imgIdx == null || imgIdx < 0) {
                imgIdx = 0;
            } else {
                imgIdx = Math.min(imgIdx, maxImageIndexInclusive);
            }
        }
        Integer orderInImage = m.orderInImage();
        if (orderInImage != null && orderInImage < 0) {
            orderInImage = 0;
        }
        String sender = normalizeExtractionSender(m.sender());
        Double senderConf = normalizeExtractionConfidence(m.senderConfidence());
        String convId = safe(m.conversationId()).trim();
        if (convId.isEmpty() || !validConvIds.contains(convId)) {
            convId = imageToConvId.getOrDefault(imgIdx, validConvIds.isEmpty() ? "c1" : validConvIds.iterator().next());
        }
        String senderLabel = trimToNull(m.senderLabel());
        String text = m.text() != null ? m.text() : "";
        Double textConf = normalizeExtractionConfidence(m.textConfidence());
        String timestampText = m.timestampText();
        if (timestampText != null && timestampText.isBlank()) {
            timestampText = null;
        }
        boolean partial = Boolean.TRUE.equals(m.isPartial());
        boolean unread = Boolean.TRUE.equals(m.hasUnreadableFragment());
        return new ExtractedMessage(
                messageId,
                gOrder,
                imgIdx,
                orderInImage,
                convId,
                sender,
                senderConf,
                senderLabel,
                m.repliesToVisibleMessageId(),
                text,
                textConf,
                timestampText,
                partial,
                unread
        );
    }

    private static String allocateMessageId(String rawId, Set<String> usedIds, int sequenceFallback) {
        String base = safe(rawId).trim();
        if (base.isEmpty()) {
            base = "m" + (sequenceFallback + 1);
        }
        String candidate = base;
        int n = 0;
        while (usedIds.contains(candidate)) {
            n++;
            candidate = base + "_" + n;
        }
        usedIds.add(candidate);
        return candidate;
    }

    private static ExtractedMessage fixReplyTarget(ExtractedMessage m, Set<String> allIds) {
        String fixedReply = resolveReplyRef(m.repliesToVisibleMessageId(), allIds);
        return new ExtractedMessage(
                m.messageId(),
                m.globalOrder(),
                m.imageIndex(),
                m.orderInImage(),
                m.conversationId(),
                m.sender(),
                m.senderConfidence(),
                m.senderLabel(),
                fixedReply,
                m.text(),
                m.textConfidence(),
                m.timestampText(),
                m.isPartial(),
                m.hasUnreadableFragment()
        );
    }

    private static String resolveReplyRef(String raw, Set<String> allIds) {
        if (raw == null) {
            return null;
        }
        String t = raw.trim();
        if (t.isEmpty() || !allIds.contains(t)) {
            return null;
        }
        return t;
    }

    private static String normalizeExtractionSender(String sender) {
        String s = safe(sender).toLowerCase(Locale.ROOT).trim();
        return switch (s) {
            case "user", "woman", "unknown" -> s;
            default -> "unknown";
        };
    }

    private static Double normalizeExtractionConfidence(Double v) {
        if (v == null) {
            return 0.5;
        }
        if (v.isNaN() || v.isInfinite()) {
            return 0.5;
        }
        if (v < 0.0) {
            return 0.0;
        }
        if (v > 1.0) {
            return 1.0;
        }
        return v;
    }

    private static ExtractionQuality normalizeExtractionQuality(ExtractionQuality q) {
        if (q == null) {
            return new ExtractionQuality("low", List.of("No extraction_quality in model output"));
        }
        String label = safe(q.label()).toLowerCase(Locale.ROOT).trim();
        label = switch (label) {
            case "high", "medium", "low" -> label;
            default -> "low";
        };
        List<String> reasons = nullSafeStatic(q.reasons()).stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .limit(12)
                .collect(Collectors.toList());
        if (reasons.isEmpty()) {
            reasons = List.of("unspecified");
        }
        return new ExtractionQuality(label, reasons);
    }

    private static <T> List<T> nullSafeStatic(List<T> list) {
        return list == null ? List.of() : list.stream().filter(Objects::nonNull).collect(Collectors.toList());
    }

    private List<RetrievalQuery> sanitizeQueries(List<RetrievalQuery> rawQueries, String userText) {
        List<RetrievalQuery> input = rawQueries == null ? List.of() : rawQueries;
        LinkedHashMap<String, RetrievalQuery> unique = new LinkedHashMap<>();
        for (RetrievalQuery q : input) {
            if (q == null || q.text() == null) continue;
            String text = normalizeQueryText(q.text());
            if (text.isBlank()) continue;
            if (text.length() > MAX_QUERY_LENGTH) {
                text = text.substring(0, MAX_QUERY_LENGTH).trim();
            }
            String key = dedupeKey(text);
            if (unique.containsKey(key)) continue;
            String type = normalizeType(q.type());
            Double confidence = clamp01(q.confidence());
            unique.put(key, new RetrievalQuery(type, text, confidence));
            if (unique.size() >= MAX_RETRIEVAL_QUERIES) break;
        }
        if (unique.isEmpty()) return fallbackQueries(userText);
        return new ArrayList<>(unique.values());
    }

    private List<RetrievalQuery> fallbackQueries(String userText) {
        String fallbackText = normalizeQueryText(safe(userText));
        if (fallbackText.isBlank()) return List.of();
        if (fallbackText.length() > MAX_QUERY_LENGTH) {
            fallbackText = fallbackText.substring(0, MAX_QUERY_LENGTH).trim();
        }
        return List.of(new RetrievalQuery("primary", fallbackText, 0.5));
    }

    private String normalizeQueryText(String value) {
        String s = safe(value).replaceAll("\\s+", " ").trim();
        s = s.replaceAll("([!?.,;:])\\1+", "$1");
        return s;
    }

    private String dedupeKey(String text) {
        return text.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    private String normalizeType(String value) {
        String type = safe(value).toLowerCase(Locale.ROOT).trim();
        return switch (type) {
            case "primary", "interpretation", "action", "lexical" -> type;
            default -> "primary";
        };
    }

    private Double clamp01(Double v) {
        if (v == null) return 0.5;
        if (v < 0.0) return 0.0;
        if (v > 1.0) return 1.0;
        return v;
    }

    private static <T> List<T> nullSafe(List<T> list) {
        return list == null ? List.of() : list.stream().filter(Objects::nonNull).collect(Collectors.toList());
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return "{}";
        }
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    private String fetchAnalysisPlanningJson(String userPayloadJson) {
        String first = llmProxyService.completeSimple(ANALYSIS_AND_PLANNING_PROMPT, userPayloadJson, 0.2, STAGE2_ANALYSIS_MAX_TOKENS);
        if (!looksLikeTruncatedJson(first)) {
            return first;
        }
        String compact = ANALYSIS_AND_PLANNING_PROMPT
                + "\nДополнительно: компактный JSON; conversation_analyses[] по одному блоку на conversation_id; evidence_message_ids ≤ 2; features ≤ 8; не смешивать чаты; reciprocity_signal у каждой аннотации; hypotheses ≤ 4; при малых n — низкий confidence гипотез; не завышай confidence.";
        return llmProxyService.completeSimple(compact, userPayloadJson, 0.2, STAGE2_ANALYSIS_RETRY_MAX_TOKENS);
    }

    private boolean looksLikeTruncatedJson(String raw) {
        String s = extractJsonPayload(raw);
        if (s.isBlank()) return true;
        int braces = 0;
        int brackets = 0;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '{') braces++;
            else if (c == '}') braces--;
            else if (c == '[') brackets++;
            else if (c == ']') brackets--;
        }
        return braces > 0 || brackets > 0 || !s.trim().endsWith("}");
    }

//    private void saveDebugBundle(String extractionRaw, String stage2AnalysisRaw, String stage2ErrorOrNull) {
//        if (debugPlanningPath == null || debugPlanningPath.isBlank()) {
//            return;
//        }
//        try {
//            Path path = Path.of(debugPlanningPath).toAbsolutePath().normalize();
//            Path parent = path.getParent();
//            if (parent != null) {
//                Files.createDirectories(parent);
//            }
//            LinkedHashMap<String, Object> bundle = new LinkedHashMap<>();
//            bundle.put("stage1_extraction_raw", safe(extractionRaw));
//            bundle.put("stage2_analysis_planning_raw", safe(stage2AnalysisRaw));
//            if (stage2ErrorOrNull != null && !stage2ErrorOrNull.isBlank()) {
//                bundle.put("stage2_error", stage2ErrorOrNull);
//            }
//            Files.writeString(path, objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(bundle), StandardCharsets.UTF_8);
//        } catch (Exception ignored) {
//        }
//    }

    /** Отдельный файл при падении stage2: сырой ответ и вход extraction (рядом с debug.multimodal-planning-path). */
    private void persistStage2FailureSidecar(String extractionJson, String interactionRaw, Exception error) {
        if (debugPlanningPath == null || debugPlanningPath.isBlank()) {
            return;
        }
        try {
            Path main = Path.of(debugPlanningPath).toAbsolutePath().normalize();
            Path dir = main.getParent();
            if (dir == null) {
                dir = Path.of(".");
            }
            Files.createDirectories(dir);
            Path sidecar = dir.resolve("multimodal-stage2-failure.json");
            LinkedHashMap<String, Object> failure = new LinkedHashMap<>();
            failure.put("extraction_input_json", safe(extractionJson));
            failure.put("stage2_analysis_raw", safe(interactionRaw));
            failure.put("error_class", error.getClass().getName());
            failure.put("error_message", safe(error.getMessage()));
            Files.writeString(sidecar, objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(failure), StandardCharsets.UTF_8);
        } catch (Exception ignored) {
        }
    }

    private String extractJsonPayload(String raw) {
        String s = safe(raw).trim();
        if (s.isEmpty()) return s;

        if (s.startsWith("```")) {
            int firstLineEnd = s.indexOf('\n');
            if (firstLineEnd >= 0) {
                s = s.substring(firstLineEnd + 1);
            } else {
                return "";
            }
            int lastFence = s.lastIndexOf("```");
            if (lastFence >= 0) {
                s = s.substring(0, lastFence);
            }
            s = s.trim();
        }

        int objStart = s.indexOf('{');
        int arrStart = s.indexOf('[');
        int start = -1;
        if (objStart >= 0 && arrStart >= 0) {
            start = Math.min(objStart, arrStart);
        } else if (objStart >= 0) {
            start = objStart;
        } else if (arrStart >= 0) {
            start = arrStart;
        }
        if (start > 0) {
            s = s.substring(start).trim();
        }

        return s;
    }
}
