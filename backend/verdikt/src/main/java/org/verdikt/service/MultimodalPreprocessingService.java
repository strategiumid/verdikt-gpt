package org.verdikt.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.verdikt.dto.multimodal.ExtractionQuality;
import org.verdikt.dto.multimodal.MultimodalResult;
import org.verdikt.dto.multimodal.QueryPlanningResult;
import org.verdikt.dto.multimodal.RetrievalQuery;
import org.verdikt.dto.multimodal.VisionExtractionResult;
import org.verdikt.entity.User;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Collectors;

@Service
public class MultimodalPreprocessingService {

    private static final int MAX_QUERY_LENGTH = 180;
    private static final String VISION_MODEL = "google/gemini-3.1-pro-preview";
    private static final int PLANNING_MAX_TOKENS = 3000;
    private static final int PLANNING_RETRY_MAX_TOKENS = 3200;

    private static final String VISION_EXTRACTION_PROMPT = """
            Ты — строгий парсер скриншотов переписки.
                        
            Твоя задача:
            1. Извлечь только то, что реально видно на изображениях.
            2. Не делать психологических выводов.
            3. Не давать советы.
            4. Не определять интерес, отвержение, манипуляцию, флирт и т.д.
            5. Не дописывать скрытый или обрезанный текст.
                        
            Верни только JSON строго по схеме:
                        
            {
              "schema_version": "1.0",
              "user_text": "string",
              "messages": [
                {
                  "message_id": "string",
                  "image_index": 0,
                  "order_in_image": 0,
                  "sender": "user|woman|unknown",
                  "sender_confidence": 0.0,
                  "text": "string",
                  "text_confidence": 0.0,
                  "timestamp_text": "string|null",
                  "is_partial": true,
                  "has_unreadable_fragment": true
                }
              ],
              "visible_facts": ["string"],
              "missing_context": ["string"],
              "extraction_quality": {
                "label": "high|medium|low",
                "reasons": ["string"]
              }
            }
                        
            Правила:
            - messages должны идти в видимом порядке сверху вниз, слева направо.
            - sender = unknown, если отправитель неочевиден.
            - image_index в каждом message должен соответствовать индексу изображения во входном наборе (0..N-1).
            - sender_confidence и text_confidence — числа от 0.0 до 1.0.
            - timestamp_text = null, если время не видно.
            - is_partial = true, если пузырь сообщения или текст виден не полностью.
            - has_unreadable_fragment = true, если внутри текста есть нечитаемый фрагмент (закрыт, смазан, обрезан).
            - visible_facts должны содержать только проверяемые наблюдения из изображения.
            - missing_context должен перечислять, чего не хватает для полной интерпретации.
            - Если сообщений не видно, верни пустой массив messages и укажи причину в missing_context.
            - Не добавляй markdown.
            - Не добавляй текст вне JSON.
            """;

    private static final String QUERY_PLANNING_PROMPT = """
            Ты строишь план retrieval-запросов для RAG-системы по теме отношений.
                        
            Вход:
            - user_text: что спрашивает пользователь
            - extraction_result: строгое извлечение видимого контента из скриншотов
                        
            Твоя задача:
            1. Кратко определить, что хочет понять пользователь.
            2. Построить осторожные гипотезы по каждому видимому сообщению, если это действительно возможно.
            3. Построить осторожные гипотезы по переписке в целом.
            4. Сгенерировать от 1 до 4 retrieval-запросов для поиска по FAQ базе.
                        
            Верни только JSON строго по схеме:
                        
            {
              "schema_version": "1.0",
              "intent_summary": "string",
              "message_annotations": [
                {
                  "message_id": "string",
                  "tone_hypothesis": {
                    "label": "neutral|warm|cold|flirty|ignoring|rejecting|testing|unclear",
                    "confidence": 0.0,
                    "evidence": ["string"]
                  }
                }
              ],
              "conversation_hypotheses": [
                {
                  "label": "low_engagement|mixed_interest|unclear|other",
                  "confidence": 0.0,
                  "evidence": ["string"]
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
            - Не выдумывай факты, которых нет в extraction_result.
            - Используй sender_confidence/text_confidence/has_unreadable_fragment для оценки уверенности.
            - Если text_confidence низкий или has_unreadable_fragment=true, помечай tone_hypothesis как label=unclear и снижай confidence.
            - Если данных мало, используй label=unclear и снижай confidence.
            - confidence должен быть от 0.0 до 1.0.
            - retrieval_queries должно быть от 1 до 4.
            - Все retrieval-запросы должны быть различимыми по смыслу.
            - primary: главный вопрос пользователя.
            - interpretation: что может означать поведение.
            - action: как действовать/отвечать.
            - lexical: короткий запрос, близкий к словам переписки.
            - Если lexical не нужен, не добавляй его.
            - Не добавляй markdown.
            - Не добавляй текст вне JSON.
            """;

    private final LlmProxyService llmProxyService;
    private final ImageAttachmentService imageAttachmentService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String debugPlanningPath;

    public MultimodalPreprocessingService(LlmProxyService llmProxyService,
                                          ImageAttachmentService imageAttachmentService,
                                          @Value("${debug.multimodal-planning-path:src/main/resources/debug/multimodal-planning.json}") String debugPlanningPath) {
        this.llmProxyService = llmProxyService;
        this.imageAttachmentService = imageAttachmentService;
        this.debugPlanningPath = debugPlanningPath;
    }

    public MultimodalResult buildQueries(User user, String userText, List<String> imageIds) {
        if (imageIds == null || imageIds.isEmpty()) {
            return new MultimodalResult(List.of(), null, null);
        }

        List<String> dataUrls = new ArrayList<>();
        int totalImages = Math.min(imageIds.size(), 10);
        for (int i = 0; i < totalImages; i++) {
            dataUrls.add(imageAttachmentService.loadOwnedImageAsDataUrl(user, imageIds.get(i)));
        }

        final String extractionJson;
        try {
            extractionJson = llmProxyService.completeMultimodalJson(
                    VISION_EXTRACTION_PROMPT,
                    safe(userText),
                    dataUrls,
                    0.2,
                    4000,
                    VISION_MODEL
            );
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Не удалось проанализировать изображения");
        }

        VisionExtractionResult extraction = parseExtraction(extractionJson, userText);

        // Stage 2: planning (interpretation + retrieval query generation).
        String queryInput = "user_text: " + safe(userText) + "\nextraction_result: " + toJson(extraction);
        final String planningJson;
        try {
            planningJson = fetchPlanningJson(queryInput);
        } catch (Exception e) {
            List<RetrievalQuery> fallback = fallbackQueries(userText);
            return new MultimodalResult(fallback, extraction, null);
        }

        try {
            QueryPlanningResult planning = objectMapper.readValue(extractJsonPayload(planningJson), QueryPlanningResult.class);
            List<RetrievalQuery> queries = sanitizeQueries(planning != null ? planning.retrievalQueries() : null, userText);
            QueryPlanningResult normalizedPlanning = planning == null
                    ? null
                    : new QueryPlanningResult(
                    safe(planning.schemaVersion()),
                    safe(planning.intentSummary()),
                    nullSafe(planning.messageAnnotations()),
                    nullSafe(planning.conversationHypotheses()),
                    queries
            );
            return new MultimodalResult(queries, extraction, normalizedPlanning);
        } catch (Exception e) {
            List<RetrievalQuery> fallback = fallbackQueries(userText);
            return new MultimodalResult(fallback, extraction, null);
        }
    }

    private VisionExtractionResult parseExtraction(String extractionJson, String userText) {
        try {
            VisionExtractionResult parsed = objectMapper.readValue(extractJsonPayload(extractionJson), VisionExtractionResult.class);
            if (parsed == null) throw new IllegalArgumentException("empty");
            return new VisionExtractionResult(
                    safe(parsed.schemaVersion()).isBlank() ? "1.0" : parsed.schemaVersion(),
                    safe(userText),
                    nullSafe(parsed.messages()),
                    nullSafe(parsed.visibleFacts()),
                    nullSafe(parsed.missingContext()),
                    parsed.extractionQuality() != null
                            ? parsed.extractionQuality()
                            : new ExtractionQuality("low", List.of("No extraction_quality in model output"))
            );
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Некорректный JSON результата визуального извлечения");
        }
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
            if (unique.size() >= 4) break;
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

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private String fetchPlanningJson(String queryInput) {
        String first = llmProxyService.completeSimple(QUERY_PLANNING_PROMPT, queryInput, 0.2, PLANNING_MAX_TOKENS);
        if (!looksLikeTruncatedJson(first)) {
            return first;
        }
        String compactPrompt = QUERY_PLANNING_PROMPT
                + "\nДополнительно: ответ должен быть компактным; evidence максимум 1 пункт в каждом объекте.";
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

    private void savePlanningJsonForDebug(String planningJson) {
        if (debugPlanningPath == null || debugPlanningPath.isBlank()) return;
        try {
            Path path = Path.of(debugPlanningPath).toAbsolutePath().normalize();
            Path parent = path.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
            Files.writeString(path, safe(planningJson), StandardCharsets.UTF_8);
        } catch (Exception ignored) {
            // Debug persistence must not break the main flow.
        }
    }

    /**
     * Some models occasionally wrap JSON in markdown code fences.
     * Normalize output to raw JSON before Jackson parsing.
     */
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
