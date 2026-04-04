package org.verdikt.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * LLM: превращает реплику пользователя в 1–4 FAQ-вопроса для RAG (JSON).
 */
@Service
public class RagQueryRewriteService {

    private static final String RAG_QUERY_REWRITE_SYSTEM_PROMPT = """
            Ты — Query Rewriter для RAG системы по психологии отношений и знакомств.

            Задача: преобразовать вход пользователя в 1–4 прикладных FAQ-вопроса для поиска.

            ---

            ### ОСНОВНЫЕ ПРАВИЛА

            1. ВСЕГДА ВОПРОСЫ
               Формулируй только полноценные вопросы.
               Запрещены ключевые слова и обрывки фраз.

            ---

            2. СТРОГОЕ СОХРАНЕНИЕ СМЫСЛА

            * не добавляй новых фактов
            * не придумывай детали
            * не расширяй тему
            * не смягчай формулировку

            ---

            3. ❗ ANTI-GENERALIZATION (КЛЮЧЕВОЕ)

            Контекст:
            пользователь — мужчина, речь идет о женщине.

            Обязательно:

            * используй "девушка" или "женщина", если это подразумевается
            * НЕ заменяй на:

              * "человек"
              * "кто-то"
              * "партнер"
              * "другой человек"
              * "люди"

            Если во входе есть "она" → в вопросе должно быть "девушка" или "женщина".

            ---

            4. СТИЛЬ ВОПРОСОВ

            Вопросы должны быть:

            * прикладные
            * конкретные
            * ориентированные на результат
            * как реальные запросы пользователей

            Запрещено:

            * академический стиль
            * обобщённые формулировки
            * нейтральные рассуждения

            ---

            5. ❗ ЗАПРЕТ НА "СМЯГЧЕНИЕ"

            НЕ добавляй слова:

            * "безопасно"
            * "этично"
            * "правильно с точки зрения"
            * "здорово ли"

            Если этого нет во входе — не появляйся в выводе.

            ---

            6. ВЫБОР СТРАТЕГИИ

            ### SINGLE

            * один вопрос
            * одна проблема

            ### MULTI

            * 2–4 вопроса
            * если во входе несколько аспектов

            ---

            7. ДЕКОМПОЗИЦИЯ (для MULTI)

            Каждый вопрос:

            * один смысл
            * один аспект

            Типы:

            * что это значит
            * почему она так делает
            * как это влияет
            * что делать

            ---

            8. ОГРАНИЧЕНИЯ

            * максимум 4 вопроса
            * без повторов
            * коротко и чётко
            * без лишних слов

            ---

            ### ФОРМАТ ВЫВОДА (строгий JSON)

            {
            "type": "single" | "multi",
            "reason": "кратко",
            "queries": ["вопрос 1", "вопрос 2"]
            }
            """;

    private static final String FACTS_SYSTEM_SUFFIX = """

            Если переданы дополнительные факты пользователя:
            - используй их только для устранения неоднозначности
            - не включай все факты в каждый вопрос
            - не делай вопросы перегруженными деталями
            - сохраняй вопросы короткими и пригодными для retrieval
            """;

    private final LlmProxyService llmProxyService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${llm.rag-query-rewrite.model:google/gemini-2.5-flash-lite}")
    private String ragQueryRewriteModel;

    public RagQueryRewriteService(LlmProxyService llmProxyService) {
        this.llmProxyService = llmProxyService;
    }

    /**
     * @param planType значение поля {@code type} из JSON rewriter: {@code single} | {@code multi}
     */
    public record RagRewriteResult(String rawJson, List<String> queries, String planType) {}

    /**
     * @param factsFromUser       факты из памяти темы (могут быть пустыми)
     * @param previousRewrites    прошлый переписанный запрос / набор запросов ({@link org.verdikt.chat.model.TopicMemory#getLastRewrite()})
     * @param lastRetrievalQueries последний набор строк запросов к retrieval ({@link org.verdikt.chat.model.TopicMemory#getLastRagRetrievalQueries()})
     */
    public RagRewriteResult rewriteUserMessage(
            String userMessage,
            List<String> factsFromUser,
            String previousRewrites,
            String lastRetrievalQueries) {
        List<String> facts = factsFromUser != null ? factsFromUser : List.of();
        boolean hasFacts = facts.stream().anyMatch(f -> f != null && !f.trim().isEmpty());
        String system = RAG_QUERY_REWRITE_SYSTEM_PROMPT + (hasFacts ? FACTS_SYSTEM_SUFFIX : "");
        String userPayload = buildRewriterUserPayload(
                userMessage,
                facts,
                previousRewrites != null ? previousRewrites : "",
                lastRetrievalQueries != null ? lastRetrievalQueries : "");

        String raw = llmProxyService.completeSimpleWithModel(
                ragQueryRewriteModel,
                system,
                userPayload,
                0.2,
                1200);
        if (raw == null || raw.isBlank()) {
            return fallback(userMessage, null);
        }
        String json = extractJsonObject(raw.trim());
        if (json == null) {
            return fallback(userMessage, raw);
        }
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> map = objectMapper.readValue(json, Map.class);
            List<String> queries = parseQueries(map.get("queries"));
            if (queries.isEmpty()) {
                return fallback(userMessage, raw);
            }
            return new RagRewriteResult(json, queries, normalizePlanType(map.get("type")));
        } catch (Exception e) {
            return fallback(userMessage, raw);
        }
    }

    private static String buildRewriterUserPayload(
            String userMessage,
            List<String> factsFromUser,
            String previousRewrites,
            String lastRetrievalQueries) {
        StringBuilder sb = new StringBuilder();
        sb.append("ТЕКУЩЕЕ СООБЩЕНИЕ ПОЛЬЗОВАТЕЛЯ:\n");
        sb.append(userMessage != null ? userMessage : "").append("\n\n");

        String factsBlock = formatFactsForPrompt(factsFromUser);
        if (!factsBlock.isEmpty()) {
            sb.append("ИЗВЕСТНЫЕ ФАКТЫ О ПОЛЬЗОВАТЕЛЕ (только для снятия неоднозначности):\n");
            sb.append(factsBlock).append("\n\n");
        }
        if (previousRewrites != null && !previousRewrites.isBlank()) {
            sb.append("ПРЕДЫДУЩИЙ ПЕРЕПИСАННЫЙ ЗАПРОС / ЗАПРОСЫ ДЛЯ ПОИСКА:\n");
            sb.append(previousRewrites.trim()).append("\n\n");
        }
        if (lastRetrievalQueries != null && !lastRetrievalQueries.isBlank()) {
            sb.append("ПОСЛЕДНИЙ НАБОР ЗАПРОСОВ К RETRIEVAL (прошлый ход):\n");
            sb.append(lastRetrievalQueries.trim()).append("\n\n");
        }
        sb.append("Сформируй JSON с вопросами для поиска по текущему сообщению пользователя.");
        return sb.toString();
    }

    private static String formatFactsForPrompt(List<String> facts) {
        if (facts == null || facts.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        int n = 0;
        for (String f : facts) {
            if (f == null) {
                continue;
            }
            String t = f.trim();
            if (t.isEmpty()) {
                continue;
            }
            sb.append("- ").append(t).append("\n");
            if (++n >= TopicMemoryFactsHelper.MAX_FACTS) {
                break;
            }
        }
        return sb.toString().trim();
    }

    private RagRewriteResult fallback(String userMessage, String raw) {
        String u = userMessage != null ? userMessage.trim() : "";
        if (u.isEmpty()) {
            u = ".";
        }
        List<String> one = List.of(u);
        try {
            Map<String, Object> m = new java.util.LinkedHashMap<>();
            m.put("type", "single");
            m.put("reason", "fallback");
            m.put("queries", one);
            String json = objectMapper.writeValueAsString(m);
            return new RagRewriteResult(raw != null && !raw.isBlank() ? raw : json, one, "single");
        } catch (Exception e) {
            return new RagRewriteResult(raw, one, "single");
        }
    }

    /** {@code multi} только при явном значении; иначе {@code single}. */
    private static String normalizePlanType(Object typeObj) {
        if (!(typeObj instanceof String s) || s.isBlank()) {
            return "single";
        }
        return "multi".equalsIgnoreCase(s.trim()) ? "multi" : "single";
    }

    @SuppressWarnings("unchecked")
    private static List<String> parseQueries(Object queriesObj) {
        if (!(queriesObj instanceof List<?> list)) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        for (Object item : list) {
            if (out.size() >= 4) {
                break;
            }
            if (item instanceof String s) {
                String t = s.trim();
                if (!t.isEmpty()) {
                    out.add(t);
                }
            }
        }
        return out;
    }

    private static String extractJsonObject(String s) {
        int start = s.indexOf('{');
        int end = s.lastIndexOf('}');
        if (start < 0 || end < 0 || end <= start) {
            return null;
        }
        return s.substring(start, end + 1);
    }
}
