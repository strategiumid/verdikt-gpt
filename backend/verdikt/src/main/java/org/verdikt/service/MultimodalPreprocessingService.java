package org.verdikt.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.verdikt.dto.multimodal.ConversationDynamics;
import org.verdikt.dto.multimodal.ConversationHypothesis;
import org.verdikt.dto.multimodal.ExtractionQuality;
import org.verdikt.dto.multimodal.ExtractedMessage;
import org.verdikt.dto.multimodal.InteractionAnalysisResult;
import org.verdikt.dto.multimodal.InteractionFeatureItem;
import org.verdikt.dto.multimodal.MessageAnnotation;
import org.verdikt.dto.multimodal.ParticipantSideMetrics;
import org.verdikt.dto.multimodal.MultimodalResult;
import org.verdikt.dto.multimodal.QueryPlanningResult;
import org.verdikt.dto.multimodal.RetrievalQuery;
import org.verdikt.dto.multimodal.ToneHypothesis;
import org.verdikt.dto.multimodal.VisionExtractionResult;
import org.verdikt.entity.User;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class MultimodalPreprocessingService {

    private static final Logger log = LoggerFactory.getLogger(MultimodalPreprocessingService.class);

    private static final int MAX_QUERY_LENGTH = 180;

    private static final int EXTRACTION_MAX_TOKENS = 6000;
    private static final int INTERACTION_MAX_TOKENS = 3500;
    private static final int INTERACTION_RETRY_MAX_TOKENS = 5000;
    private static final int PLANNING_MAX_TOKENS = 4000;
    private static final int PLANNING_RETRY_MAX_TOKENS = 5000;

    private static final int MAX_EVIDENCE_STRINGS = 2;
    private static final int MAX_EVIDENCE_MESSAGE_IDS = 2;
    private static final int MAX_INTERACTION_FEATURES = 8;
    private static final int MAX_CONVERSATION_HYPOTHESES = 4;
    private static final int MAX_RETRIEVAL_QUERIES = 4;

    /** Текст user-сообщения для vision-API: без вопроса пользователя, только контекст картинок. */
    private static final String VISION_EXTRACTION_USER_MESSAGE = """
            Ниже приложены изображения скриншотов переписки. Верни один JSON-объект строго по схеме из system-сообщения, без markdown.""";

    private static final String VISION_EXTRACTION_PROMPT = """
            Ты — технический парсер скриншотов переписки. Ты НЕ психолог, НЕ советчик, НЕ интерпретируешь интерес, дистанцию или мотивы.
            Не додумывай скрытые сообщения и не восстанавливай обрезанный текст.
                        
            ЗАПРЕЩЕНО в текстах, visible_facts и полях сообщений использовать интерпретации вроде:
            «холодная», «заинтересована», «теряет интерес», «игнорирует», «проверяет», «отталкивает», «манипулирует» и т.п.
            Только то, что можно проверить глазами на изображении.
                        
            Задача этапа — аккуратный «OCR + разметка»: одно логическое сообщение = одна запись в messages. Не сливай несколько реплик в одну.
            Сохраняй орфографию в тексте как на скрине. Элементы интерфейса не считай сообщениями, если это не пузырь/реплика чата.
                        
            Верни только JSON по схеме (без markdown, без текста вне JSON):
                        
            {
              "schema_version": "2.0",
              "messages": [
                {
                  "message_id": "string — стабильный id внутри ответа, например m1, m2",
                  "global_order": 0,
                  "image_index": 0,
                  "order_in_image": 0,
                  "sender": "user|woman|unknown",
                  "sender_confidence": 0.0,
                  "message_type": "text|emoji_only|sticker|media|system|unknown",
                  "bubble_side": "left|right|center|unknown",
                  "has_emoji": true,
                  "replies_to_visible_message_id": "string|null — id другого сообщения из этого же массива, если визуально видно ответ",
                  "text": "string",
                  "text_confidence": 0.0,
                  "timestamp_text": "string|null",
                  "is_partial": true,
                  "has_unreadable_fragment": true
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
            - В text попадают ТОЛЬКО символы, находящиеся ВНУТРИ пузыря сообщения.
            - Любые элементы вне пузыря (включая):
              - реакции Telegram
              - маленькие эмодзи под сообщением
              - плашки
              - иконки
              - аватары
              - декоративные элементы
            — полностью игнорируются:
              ❌ не добавлять в text
              ❌ не создавать записи в messages
              ❌ не учитывать как emoji_only / sticker / media
                        
            message_type (только для содержимого внутри пузыря):
            - emoji_only — в пузыре только эмодзи как отдельное сообщение.
            - sticker / media — только если стикер/медиа внутри пузыря сообщения, а не UI снаружи.
            - system / text / unknown — по обычным правилам.
                        
            Пример: пузырь «Привет», под ним снаружи пузыря ❤️ (реакция) — в messages одна запись с text «Привет»; ❤️ не в text, не отдельная запись, не emoji_only.
                        
            Правила:
            - global_order: сквозной порядок по всем скриншотам (0,1,2,…) в порядке чтения переписки.
            - messages: порядок сверху вниз по видимой ленте; image_index = индекс картинки во входном наборе (0..N-1).
            - sender_confidence, text_confidence — от 0.0 до 1.0.
            - is_partial / has_unreadable_fragment — как в схеме.
            - Если text_confidence низкий — не угадывай и не восстанавливай слова; помечай неуверенность и при необходимости has_unreadable_fragment.
            - Если внутри пузыря только стикер — message_type=sticker; внутри пузыря только эмодзи (отдельное сообщение) — emoji_only; не выдумывай обычный текст в поле text.
            - Не объединяй соседние короткие сообщения одного отправителя в одно: каждая отдельная реплика в UI = отдельный элемент messages.
            - replies_to_visible_message_id указывай только если визуальная связь «ответ на …» действительно видна на скрине.
            - Если sender выводится только по стороне/цвету пузыря и это неочевидно — снижай sender_confidence и при сомнении sender=unknown.
            - Если сообщений нет — messages: [] и причина в missing_context.
            - Не добавляй поле user_text и не копируй гипотетический «вопрос пользователя» — извлечение только по картинкам.
            """;

    private static final String INTERACTION_ANALYSIS_PROMPT = """
            Ты анализируешь СТРУКТУРУ взаимодействия в переписке по УЖЕ извлечённым данным (extraction_result), а не «смысл отношений» и не психологию личности.
            Ты не психолог и не выносишь диагнозов. Не используй токсичные или обвиняющие ярлыки (навязчивость, абьюз, манипуляция и т.д.).
            Опирайся только на видимое в extraction: тексты, порядок, типы сообщений, частичность, метки отправителя, confidence.
            Ищи нейтральные наблюдаемые паттерны: инициатива, усилие, взаимность, короткие ответы, реактивность, вопросы, движение/закрытие темы, сдвиг динамики.
                        
            Порядок работы:
            - Сначала оцени наблюдаемые паттерны по каждому участнику (participant_user / participant_woman), затем асимметрию между ними.
            - Не делай сильных выводов по 1–2 сообщениям; при очень короткой переписке чаще используй unclear на уровнях.
            - Каждый interaction_feature должен опираться на конкретные message_id из extraction, а не на общую интуицию.
                        
            Верни только JSON (без markdown):
                        
            {
              "schema_version": "2.0",
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
                  "label": "short_replies|initiative_imbalance|low_reciprocity|low_question_reciprocity|effort_asymmetry|topic_closure|topic_maintenance_asymmetry|question_avoidance|answer_without_expansion|delayed_responsiveness|warmth_asymmetry|reactive_participation|mixed_signals|other",
                  "applies_to": "user|woman|conversation|unclear",
                  "confidence": 0.0,
                  "evidence_message_ids": ["message_id из extraction"]
                }
              ],
              "conversation_dynamics": {
                "initiative_balance": "user_dominant|balanced|woman_dominant|unclear",
                "engagement_balance": "user_heavier|balanced|woman_heavier|unclear",
                "warmth_balance": "user_warmer|balanced|woman_warmer|unclear",
                "responsiveness_pattern": "engaged|mixed|dry|unclear",
                "trajectory": "warming|stable|cooling|mixed|unclear"
              }
            }
                        
            Про applies_to: используй conversation для признаков про связь/асимметрию между сторонами (initiative_imbalance, effort_asymmetry, warmth_asymmetry и т.п.), user|woman — когда паттерн в основном про одну сторону, unclear — при нехватке данных.
                        
            Лимиты:
            - interaction_features: не больше 8 объектов.
            - У каждого признака evidence_message_ids: не больше 2 id.
            - Не выдумывай message_id — только из extraction_result.messages.
            - Поля conversation_dynamics — ТОЛЬКО перечисленные enum-значения, без свободного текста.
            """;

    private static final String QUERY_PLANNING_PROMPT = """
            Ты строишь осторожную интерпретацию и retrieval-запросы для RAG по отношениям и перепискам.
                        
            Вход (JSON-объект в тексте запроса пользователя):
            - user_text — что спрашивает пользователь
            - extraction_result — только видимые факты и разметка (этап 1)
            - interaction_analysis — паттерны взаимодействия (этап 2); если null, опирайся только на extraction, очень осторожно
                        
            Разделение:
            - Факты — из extraction.
            - Паттерны — из interaction_analysis.
            - Гипотезы ниже — только как гипотезы, не как истина; у каждой есть confidence и evidence (макс. 2 пункта).
            - retrieval_queries строить из паттернов и гипотез, а не из «сырых» сообщений в обход interaction_analysis (если он есть).
                        
            Важно (против overclaiming):
            - Если interaction_analysis = null, НЕ компенсируй это агрессивной интерпретацией только по коротким сообщениям; держи гипотезы узкими и чаще unclear.
            - Если extraction неполный, много is_partial/has_unreadable_fragment или низкие text_confidence — гипотезы должны быть уже и осторожнее, confidence ниже.
            - Не повышай confidence гипотез и тона только потому, что user_text эмоционально окрашен — опирайся на extraction и (если есть) interaction_analysis.
                        
            Сначала кратко сформулируй intent_summary: что пользователь хочет понять (интерес/дистанцию, как отвечать, стоит ли продолжать и т.д.).
                        
            Верни только JSON:
                        
            {
              "schema_version": "2.0",
              "intent_summary": "string",
              "message_annotations": [
                {
                  "message_id": "string — только из extraction.messages",
                  "tone_hypothesis": {
                    "label": "neutral|warm|cold|flirty|ignoring|rejecting|testing|unclear",
                    "confidence": 0.0,
                    "evidence": ["максимум 2 коротких пункта"]
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
                  "evidence": ["максимум 2 пункта"]
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
                        
            Правила:
            - message_annotations только для сообщений, реально присутствующих в extraction.messages (видимые реплики).
            - conversation_hypotheses: не больше 4.
            - retrieval_queries: от 1 до 4, разные по смыслу; primary / interpretation / action / lexical — как раньше; lexical не обязателен.
            - Низкая уверенность в извлечении (text_confidence, has_unreadable_fragment) → чаще unclear и ниже confidence.
            - Не добавляй markdown и текст вне JSON.
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

    /** Сырой ответ этапа interaction, результат после нормализации и текст ошибки при сбое. */
    private record InteractionStageResult(
            InteractionAnalysisResult result,
            String rawResponse,
            String failureSummary
    ) {}

    public MultimodalResult buildQueries(User user, String userText, List<String> imageIds) {
        if (imageIds == null || imageIds.isEmpty()) {
            return new MultimodalResult(List.of(), null, null, null);
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

        InteractionStageResult stage2 = runInteractionStage(extraction);
        InteractionAnalysisResult interaction = stage2.result();

        String planningInput = buildPlanningInput(userText, extraction, interaction);

        final String planningJsonRaw;
        try {
            planningJsonRaw = fetchPlanningJson(planningInput);
        } catch (Exception e) {
            List<RetrievalQuery> fallback = fallbackQueries(userText);
            saveDebugBundle(extractionJsonRaw, stage2, null);
            return new MultimodalResult(fallback, extraction, interaction, null);
        }

        try {
            QueryPlanningResult planningParsed = objectMapper.readValue(extractJsonPayload(planningJsonRaw), QueryPlanningResult.class);
            QueryPlanningResult planning = normalizePlanning(planningParsed, extraction);
            List<RetrievalQuery> queries = sanitizeQueries(planning != null ? planning.retrievalQueries() : null, userText);
            QueryPlanningResult normalizedPlanning = planning == null
                    ? null
                    : new QueryPlanningResult(
                    safe(planning.schemaVersion()).isBlank() ? "2.0" : planning.schemaVersion(),
                    safe(planning.intentSummary()),
                    nullSafe(planning.messageAnnotations()),
                    nullSafe(planning.conversationHypotheses()),
                    queries
            );
            saveDebugBundle(extractionJsonRaw, stage2, planningJsonRaw);
            return new MultimodalResult(queries, extraction, interaction, normalizedPlanning);
        } catch (Exception e) {
            List<RetrievalQuery> fallback = fallbackQueries(userText);
            saveDebugBundle(extractionJsonRaw, stage2, planningJsonRaw);
            return new MultimodalResult(fallback, extraction, interaction, null);
        }
    }

    private InteractionStageResult runInteractionStage(VisionExtractionResult extraction) {
        String extractionJson = toJson(extraction);
        String interactionRaw = null;
        try {
            interactionRaw = fetchInteractionJson(extractionJson);
            InteractionAnalysisResult parsed = objectMapper.readValue(extractJsonPayload(interactionRaw), InteractionAnalysisResult.class);
            InteractionAnalysisResult normalized = normalizeInteraction(parsed, extraction);
            return new InteractionStageResult(normalized, interactionRaw, null);
        } catch (Exception e) {
            log.warn("Multimodal stage2 (interaction) failed: {} — rawLength={}",
                    e.getMessage(), interactionRaw != null ? interactionRaw.length() : 0, e);
            persistStage2FailureSidecar(extractionJson, interactionRaw, e);
            String summary = e.getClass().getSimpleName() + ": " + safe(e.getMessage());
            return new InteractionStageResult(null, interactionRaw != null ? interactionRaw : "", summary);
        }
    }

    private String buildPlanningInput(String userText, VisionExtractionResult extraction, InteractionAnalysisResult interaction) {
        LinkedHashMap<String, Object> payload = new LinkedHashMap<>();
        payload.put("user_text", safe(userText));
        payload.put("extraction_result", extraction);
        payload.put("interaction_analysis", interaction);
        return toJson(payload);
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
                        safe(f.label()),
                        normalizeAppliesTo(f.appliesTo()),
                        clamp01(f.confidence()),
                        capList(f.evidenceMessageIds(), MAX_EVIDENCE_MESSAGE_IDS, allowedIds)
                ))
                .collect(Collectors.toList());

        return new InteractionAnalysisResult(
                safe(raw.schemaVersion()).isBlank() ? "2.0" : raw.schemaVersion(),
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

        return new QueryPlanningResult(
                safe(raw.schemaVersion()).isBlank() ? "2.0" : raw.schemaVersion(),
                safe(raw.intentSummary()),
                annotations,
                hypotheses,
                nullSafe(raw.retrievalQueries())
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
        List<ExtractedMessage> raw = nullSafe(parsed.messages());
        LinkedHashSet<String> usedIds = new LinkedHashSet<>();
        List<ExtractedMessage> pass1 = new ArrayList<>();
        int seq = 0;
        for (ExtractedMessage m : raw) {
            if (m == null) {
                continue;
            }
            if ("reaction".equalsIgnoreCase(safe(m.messageType()).trim())) {
                continue;
            }
            String id = allocateMessageId(m.messageId(), usedIds, seq);
            pass1.add(normalizeExtractedMessageFields(m, id, seq, maxImageIndexInclusive));
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
                safe(parsed.schemaVersion()).isBlank() ? "2.0" : parsed.schemaVersion().trim(),
                "",
                messages,
                visibleFacts,
                missingContext,
                quality
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

    private static ExtractedMessage normalizeExtractedMessageFields(ExtractedMessage m,
                                                                   String messageId,
                                                                   int defaultOrderIndex,
                                                                   int maxImageIndexInclusive) {
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
        Double sc = normalizeExtractionConfidence(m.senderConfidence());
        Double tc = normalizeExtractionConfidence(m.textConfidence());
        String messageType = normalizeExtractionMessageType(m.messageType());
        String bubbleSide = normalizeExtractionBubbleSide(m.bubbleSide());
        boolean hasEmoji = Boolean.TRUE.equals(m.hasEmoji());
        String text = m.text() != null ? m.text() : "";
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
                sender,
                sc,
                messageType,
                bubbleSide,
                hasEmoji,
                m.repliesToVisibleMessageId(),
                text,
                tc,
                timestampText,
                partial,
                unread
        );
    }

    private static ExtractedMessage fixReplyTarget(ExtractedMessage m, Set<String> allIds) {
        String fixedReply = resolveReplyRef(m.repliesToVisibleMessageId(), allIds);
        return new ExtractedMessage(
                m.messageId(),
                m.globalOrder(),
                m.imageIndex(),
                m.orderInImage(),
                m.sender(),
                m.senderConfidence(),
                m.messageType(),
                m.bubbleSide(),
                m.hasEmoji(),
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

    private static String normalizeExtractionMessageType(String value) {
        String s = safe(value).toLowerCase(Locale.ROOT).trim();
        if ("reaction".equals(s)) {
            return "unknown";
        }
        return switch (s) {
            case "text", "emoji_only", "sticker", "media", "system", "unknown" -> s;
            default -> "unknown";
        };
    }

    private static String normalizeExtractionBubbleSide(String value) {
        String s = safe(value).toLowerCase(Locale.ROOT).trim();
        return switch (s) {
            case "left", "right", "center", "unknown" -> s;
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

    private <T> List<T> nullSafe(List<T> list) {
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

    private String fetchInteractionJson(String extractionJson) {
        String first = llmProxyService.completeSimple(INTERACTION_ANALYSIS_PROMPT, extractionJson, 0.2, INTERACTION_MAX_TOKENS);
        if (!looksLikeTruncatedJson(first)) {
            return first;
        }
        String compact = INTERACTION_ANALYSIS_PROMPT
                + "\nДополнительно: компактный JSON; evidence_message_ids ≤ 2; interaction_features ≤ 8; conversation_dynamics строго enum из схемы; applies_to: user|woman|conversation|unclear.";
        return llmProxyService.completeSimple(compact, extractionJson, 0.2, INTERACTION_RETRY_MAX_TOKENS);
    }

    private String fetchPlanningJson(String queryInput) {
        String first = llmProxyService.completeSimple(QUERY_PLANNING_PROMPT, queryInput, 0.2, PLANNING_MAX_TOKENS);
        if (!looksLikeTruncatedJson(first)) {
            return first;
        }
        String compactPrompt = QUERY_PLANNING_PROMPT
                + "\nДополнительно: компактный ответ; evidence ≤ 2; conversation_hypotheses ≤ 4; reciprocity_signal для каждой аннотации; не завышай confidence.";
        return llmProxyService.completeSimple(compactPrompt, queryInput, 0.2, PLANNING_RETRY_MAX_TOKENS);
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

    private void saveDebugBundle(String extractionRaw, InteractionStageResult stage2, String planningRaw) {
        if (debugPlanningPath == null || debugPlanningPath.isBlank()) {
            return;
        }
        try {
            Path path = Path.of(debugPlanningPath).toAbsolutePath().normalize();
            Path parent = path.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            LinkedHashMap<String, Object> bundle = new LinkedHashMap<>();
            bundle.put("stage1_extraction_raw", safe(extractionRaw));
            bundle.put("stage2_interaction_raw", stage2 != null ? safe(stage2.rawResponse()) : "");
            if (stage2 != null && stage2.failureSummary() != null && !stage2.failureSummary().isBlank()) {
                bundle.put("stage2_error", stage2.failureSummary());
            }
            bundle.put("stage3_planning_raw", safe(planningRaw));
            Files.writeString(path, objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(bundle), StandardCharsets.UTF_8);
        } catch (Exception ignored) {
        }
    }

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
            failure.put("interaction_raw", safe(interactionRaw));
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
