package org.verdikt.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.verdikt.chat.model.TopicMemory;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class MemoryUpdateService {

    private final LlmProxyService llmProxyService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String MEMORY_UPDATE_SYSTEM_PROMPT = """
            Ты — модуль обновления памяти для многоходового RAG-чата про отношения.

            Твоя задача — создать компактное структурированное обновление памяти по текущей теме.

            Ты должен:
            - очень кратко и нейтрально суммировать ответ ассистента (для памяти)
            - извлечь только устойчивые факты, которые пользователь сказал явно
            - осторожно определить ближайшую цель пользователя
            - НЕ добавлять факты, которых пользователь не говорил
            - НЕ выдумывать недостающий контекст
            - НЕ сохранять длинный текст
            - сделать память компактной и пригодной для последующего переписывания запросов

            Правила:
            - Верни только валидный JSON, без обёртки в ``` и без лишнего текста
            - Без markdown
            - Без объяснений
            - assistantReferenceSummary короче 200 символов
            - newFactsFromUser: 0–3 коротких пункта (только факты от пользователя)
            - updatedUserGoal: короткая формулировка цели пользователя
            - Только факты, относящиеся к этой теме
            - Все значения в JSON (summary/facts/goal) должны быть на русском языке

            Если MULTIMODAL CONTEXT SUMMARY непустой:
            - используй его только как дополнительный контекст темы
            - не считай его прямыми словами пользователя
            - не переносить гипотезы и интерпретации из multimodal анализа в newFactsFromUser как пользовательские факты
            - в newFactsFromUser можно сохранять только нейтральные факты о предоставленных пользователем скриншотах, если они важны для темы

            Если MULTIMODAL CONTEXT SUMMARY пустой — игнорируй этот блок целиком.

            Разделяй:
            - факты, явно сказанные пользователем
            - нейтральные факты о присланных скриншотах
            Не записывай модельные интерпретации скриншотов как факты пользователя.

            Верни JSON строго по схеме:
            {
              "assistantReferenceSummary": "string",
              "newFactsFromUser": ["string"],
              "updatedUserGoal": "string"
            }
            """;

    public MemoryUpdateService(LlmProxyService llmProxyService) {
        this.llmProxyService = llmProxyService;
    }

    public MemoryUpdateResult buildUpdate(String topicLabel,
                                         String displayTitle,
                                         String previousUserGoal,
                                         List<String> existingFacts,
                                         String currentUserMessage,
                                         String assistantAnswer,
                                         String multimodalMemorySummary) {
        String prompt = """
                CURRENT TOPIC LABEL:
                %s

                CURRENT TOPIC TITLE:
                %s

                PREVIOUS USER GOAL:
                %s

                EXISTING FACTS FROM USER:
                %s

                CURRENT USER MESSAGE:
                %s

                MULTIMODAL CONTEXT SUMMARY:
                %s

                ASSISTANT ANSWER:
                %s
                """.formatted(
                safe(topicLabel),
                safe(displayTitle),
                safe(previousUserGoal),
                toJsonArray(existingFacts),
                safe(currentUserMessage),
                safe(multimodalMemorySummary),
                safe(assistantAnswer)
        );

        String raw = llmProxyService.completeSimple(MEMORY_UPDATE_SYSTEM_PROMPT, prompt, 0.2, 450);
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String json = extractJsonObject(raw.trim());
        if (json == null) {
            return null;
        }
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> map = objectMapper.readValue(json, Map.class);
            String summary = asString(map.get("assistantReferenceSummary"));
            List<String> newFacts = asStringList(map.get("newFactsFromUser"));
            String updatedGoal = asString(map.get("updatedUserGoal"));
            String summaryTrimmed = (summary != null && !summary.isBlank()) ? trimTo(summary, 500) : null;
            boolean hasFacts = !newFacts.isEmpty();
            boolean hasGoal = updatedGoal != null && !updatedGoal.isBlank();
            if (summaryTrimmed == null && !hasFacts && !hasGoal) {
                return null;
            }
            return new MemoryUpdateResult(summaryTrimmed, newFacts, updatedGoal);
        } catch (Exception ignored) {
            return null;
        }
    }

    public void applyToTopic(TopicMemory topic, MemoryUpdateResult update) {
        if (topic == null || update == null) return;
        if (update.assistantReferenceSummary() != null && !update.assistantReferenceSummary().isBlank()) {
            topic.setAssistantReferenceSummary(trimTo(update.assistantReferenceSummary(), 500));
        }
        if (update.updatedUserGoal() != null && !update.updatedUserGoal().isBlank()) {
            topic.setUserGoal(trimTo(update.updatedUserGoal(), 160));
        }
        if (update.newFactsFromUser() != null) {
            for (String f : update.newFactsFromUser()) {
                TopicMemoryFactsHelper.addIfMissing(
                        topic.getFactsFromUser(),
                        f,
                        TopicMemoryFactsHelper.MAX_FACT_LENGTH,
                        TopicMemoryFactsHelper.MAX_FACTS);
            }
            TopicMemoryFactsHelper.dedupePreserveOrder(topic.getFactsFromUser());
        }
    }

    public record MemoryUpdateResult(String assistantReferenceSummary,
                                    List<String> newFactsFromUser,
                                    String updatedUserGoal) {
    }

    private String safe(String s) {
        return s == null ? "" : s;
    }

    private String toJsonArray(List<String> list) {
        try {
            return objectMapper.writeValueAsString(list != null ? list : List.of());
        } catch (Exception e) {
            return "[]";
        }
    }

    private String extractJsonObject(String s) {
        int start = s.indexOf('{');
        int end = s.lastIndexOf('}');
        if (start < 0 || end < 0 || end <= start) return null;
        return s.substring(start, end + 1);
    }

    private String asString(Object o) {
        return (o instanceof String s) ? s : null;
    }

    private List<String> asStringList(Object o) {
        if (!(o instanceof List<?> list)) return List.of();
        List<String> out = new ArrayList<>();
        for (Object item : list) {
            if (item instanceof String s) {
                String t = s.trim();
                if (!t.isBlank()) {
                    out.add(t);
                }
            }
        }
        return out;
    }

    private String trimTo(String s, int max) {
        if (s == null) return null;
        String t = s.trim();
        if (t.length() <= max) return t;
        return t.substring(0, max);
    }
}

