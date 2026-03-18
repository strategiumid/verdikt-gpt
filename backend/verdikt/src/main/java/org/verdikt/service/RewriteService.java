package org.verdikt.service;

import org.springframework.stereotype.Service;
import org.verdikt.chat.model.TopicMemory;

import java.util.stream.Collectors;

@Service
public class RewriteService {

    private final LlmProxyService llmProxyService;

    private static final String REWRITE_SYSTEM_PROMPT = """
        Ты — модуль переписывания поисковых запросов для RAG-ассистента по психологии отношений.

        Твоя задача — переписать последнее сообщение пользователя в ОДИН самостоятельный поисковый запрос
        для поиска по базе знаний.

        Ты должен:
        - сохранять смысл пользователя полностью и без искажений
        - разрешать ссылки и местоимения вроде «она», «он», «это», «в этом случае», «как ты говорил ранее»
        - использовать только факты, явно сказанные пользователем, чтобы уточнить смысл
        - НЕ использовать советы, выводы, интерпретации или позицию ассистента как часть запроса
        - НЕ отвечать на вопрос
        - НЕ давать советы
        - НЕ добавлять новые факты
        - НЕ выдумывать недостающую информацию
        - НЕ превращать запрос в ответ, стратегию, рекомендацию или план
        - держать запрос коротким, нейтральным и удобным для retrieval

        Правила:
        - Вывод — только обычный текст
        - Выведи ровно один переписанный самостоятельный запрос
        - Основа запроса — текущее сообщение пользователя
        - Используй прошлые пользовательские факты только для разрешения неоднозначности
        - Если ассистент ранее что-то советовал, НЕ включай этот совет в запрос
        - Без объяснений
        - Без JSON
        - Без markdown
        - Запрос должен быть на русском языке
        """;

    public RewriteService(LlmProxyService llmProxyService) {
        this.llmProxyService = llmProxyService;
    }

    /**
     * First message: no rewrite, return original.
     * Later turns: call LLM to rewrite into standalone search query.
     */
    public String rewrite(TopicMemory topic, String currentMessage) {
        if (topic == null) {
            return currentMessage != null ? currentMessage : "";
        }
        String input = buildRewriteInput(topic, currentMessage);
        String result = llmProxyService.completeSimple(REWRITE_SYSTEM_PROMPT, input, 0.2, 1000);
        String fallback = currentMessage != null ? currentMessage : "";
        if (result == null) return fallback;
        String trimmed = result.trim();
        if (trimmed.isBlank()) return fallback;
        // Ensure single-query output (first non-empty line).
        for (String line : trimmed.split("\\R")) {
            if (line != null && !line.trim().isBlank()) {
                return line.trim();
            }
        }
        return fallback;
    }

    public String buildRewriteInput(TopicMemory topic, String currentMessage) {
        String facts = topic.getFactsFromUser() == null
                ? ""
                : topic.getFactsFromUser().stream().collect(Collectors.joining("; "));

        return """
            АКТИВНАЯ ТЕМА:
            %s

            НАЗВАНИЕ ТЕМЫ:
            %s

            ФАКТЫ ОТ ПОЛЬЗОВАТЕЛЯ:
            %s

            ПРЕДЫДУЩИЙ ПОИСКОВЫЙ ЗАПРОС:
            %s

            ТЕКУЩЕЕ СООБЩЕНИЕ ПОЛЬЗОВАТЕЛЯ:
            %s

            Перепиши ТЕКУЩЕЕ СООБЩЕНИЕ ПОЛЬЗОВАТЕЛЯ в один самостоятельный поисковый запрос.
            Используй только факты, явно сказанные пользователем.
            Не используй выводы, советы или интерпретации ассистента.
            """.formatted(
                safe(topic.getTopicLabel()),
                safe(topic.getDisplayTitle()),
                facts,
                safe(topic.getLastRewrite()),
                safe(currentMessage)
        );
    }

    private String safe(String s) {
        return s == null ? "" : s;
    }
}
