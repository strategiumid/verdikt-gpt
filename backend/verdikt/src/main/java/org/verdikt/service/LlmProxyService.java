package org.verdikt.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.verdikt.dto.ChatCompletionsRequest;
import org.verdikt.dto.LlmCompletionResult;
import org.verdikt.dto.RagItemDto;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.stream.Collectors;

/**
 * Прокси к LLM API (routerai.ru). Ключ хранится только на бэкенде (llm.api-key).
 */
@Service
public class LlmProxyService {

    private final RestTemplate restTemplate = new RestTemplate();

    private final RagService ragService;

    @Value("${llm.api-key:}")
    private String apiKey;

    @Value("${llm.url:https://routerai.ru/api/v1/chat/completions}")
    private String llmUrl;

    /** Модель и параметры по умолчанию для запросов к LLM (если клиент их не задал). */
    @Value("${llm.model:x-ai/grok-4-fast}")
    private String defaultModel;

    @Value("${llm.rewrite_model:deepseek/deepseek-v3.2}")
    private String defaultRewriteModel;

    @Value("${llm.vision_model:x-ai/grok-4-fast}")
    private String defaultVisionModel;

    @Value("${llm.temperature:0.5}")
    private double defaultTemperature;

    @Value("${llm.max-tokens:2400}")
    private int defaultMaxTokens;

    /** Directory to save chat completions request body for debugging; files 1.json, 2.json, ... (empty = disabled). */
    @Value("${debug.chat-completions-path:src/main/resources/debug/chat-completions-request.json}")
    private String debugChatCompletionsPath;

    private static final String DEFAULT_SYSTEM_PROMPT = """
            Ты — Verdikt GPT. Эксперт по отношениям, знакомствам и психологии поведения в отношениях.
            Твоя задача — помогать пользователю разобраться в сложных эмоциональных ситуациях, понять психологические механизмы и предложить практичные шаги.
            Ты общаешься как опытный друг, который хорошо понимает психологию.
            Тон:
            • дружелюбный
            • спокойный
            • без осуждения
            • обращение на "ты" (если пользователь не использует "вы")
            Юмор допустим, но умеренно и только если это уместно.
            ПРИНЦИП РАБОТЫ
            Перед ответом кратко определи для себя:
            • какой вопрос задаёт пользователь
            • какие элементы из RAG относятся к нему
            • какие психологические механизмы описаны в RAG
            РАБОТА С RAG
            Тебе передается дополнительный контекст из базы знаний (RAG).
            Правила работы:
            • Информация из RAG имеет наивысший приоритет и всегда должна использоваться в ответе.
            • Даже если информация из RAG выглядит спорной или противоречит общим представлениям — используй её как основу объяснения.
            • Не игнорируй RAG-контекст. Ответ должен опираться на него.
            • Если в RAG есть релевантная информация — ответ должен опираться на неё, а не на знания модели.
            • Не упоминай слова «RAG», «retrieval» или «база знаний».
            Если в RAG есть несколько ответов:
            • Синтезируй их в единое объяснение.
            • Если между ними есть различия или противоречия — объясни, что существуют разные точки зрения или сценарии.
            Форма подачи:
            
            • Не цитируй RAG дословно, используй его только как база знаний чтобы сгененировать ответ.
            • Перефразируй информацию естественным языком.
            
            Разрешено:
            • объяснять
            • перефразировать
            • объединять несколько фрагментов RAG в одно объяснение
            
            Запрещено:
            • придумывать новые техники
            • добавлять новые правила поведения
            • расширять стратегию новыми шагами.
            
            Если RAG описывает поведение или стратегию,
            не расширяй её новыми действиями,
            которые прямо не указаны в RAG.
            
            СТРУКТУРА ОТВЕТА
            Ответ обычно состоит из следующих частей (если они применимы):
            1. Если пользователь описывает личную ситуацию —
            начни с короткого отражения его состояния.
            (показать, что ты понял его состояние)
            Если вопрос общий или теоретический —
            начни сразу с объяснения.
            2. Объяснение механики ситуации \s
            (почему это происходит)
            3. Практические шаги \s
            Практические шаги давай только если они присутствуют в RAG
            или если пользователь прямо просит совет.
            В конце можно предложить следующий шаг или уточняющий вопрос.
            Если информации мало — задай 1–2 уточняющих вопроса.
            
            Если RAG не содержит достаточной информации для совета —
            ограничься объяснением механики и вопросами,
            не придумывай рекомендации.
            
            ФОРМАТИРОВАНИЕ
            • Не используй символ # \s
            • Заголовки — **жирный текст** \s
            • Списки — • или - \s
            • Абзацы короткие и читаемые \s
            • Каждый абзац должен быть законченным предложением
            СПЕЦИАЛИЗАЦИЯ
            Основные темы:
            💔 Отношения \s
            • конфликты \s
            • дистанция \s
            • расставание \s
            • возврат \s
            • динамика значимости \s
            👥 Знакомства \s
            • переписка \s
            • первые свидания \s
            • развитие интереса \s
            🛡 Манипуляции \s
            • газлайтинг \s
            • обесценивание \s
            • чувство вины \s
            • защита личных границ
            СЛОЖНЫЕ СИТУАЦИИ
            Если пользователь говорит о:
            • насилии
            • тяжёлой депрессии
            • саморазрушительном поведении
            — мягко предложи обратиться к специалисту.
            ВАЖНЫЕ ОГРАНИЧЕНИЯ
            Никогда:
            • не унижай пользователя
            • не обвиняй его
            • не поддерживай разрушительное поведение
            • не поощряй манипуляции как единственную стратегию
            АДАПТАЦИЯ К ДИАЛОГУ
            Подстраивай тон:
            • больше тепла — если человек переживает
            • больше структуры — если он просит план действий
            • больше лёгкости — если пользователь шутит
            Эмодзи можно использовать, но умеренно.
""";

    public LlmProxyService(RagService ragService) {
        this.ragService = ragService;
    }

    /** Ключ настроен (задан через LLM_API_KEY). */
    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    /**
     * Добавить system prompt (если его нет) и сообщение с контекстом из RAG-сервиса.
     * Ожидается, что request содержит поле messages в формате OpenAI Chat API.
     * Возвращает список qaId использованных RAG-элементов (для сохранения в сообщении ассистента).
     */
    @SuppressWarnings("unchecked")
    public List<Long> enrichWithRagContext(ChatCompletionsRequest request) {
        List<Map<String, Object>> rawList = request.getMessages();
        if (rawList == null || rawList.isEmpty()) {
            return List.of();
        }

        List<Map<String, Object>> originalMessages = new ArrayList<>();
        for (Object o : rawList) {
            if (o instanceof Map<?, ?> m) {
                originalMessages.add((Map<String, Object>) m);
            }
        }
        if (originalMessages.isEmpty()) {
            return List.of();
        }

        String imageAnalysisStr = request.getImageAnalysis();
        if (imageAnalysisStr != null && !imageAnalysisStr.isBlank()) {
            appendImageAnalysisToLastUserMessage(originalMessages, imageAnalysisStr);
        }

        // Если задан ragQueries (multimodal) — используем их. Иначе ragQuery или последнее user-сообщение.
        List<String> queryTexts = new ArrayList<>();
        List<String> ragQueriesList = request.getRagQueries();
        if (ragQueriesList != null) {
            for (String q : ragQueriesList) {
                if (q != null && !q.isBlank()) {
                    queryTexts.add(q.trim());
                }
                if (queryTexts.size() >= 4) break;
            }
        }
        String questionText = null;
        String ragQueryField = request.getRagQuery();
        if (ragQueryField != null && !ragQueryField.isBlank()) {
            questionText = ragQueryField;
        }
        if (queryTexts.isEmpty() && questionText == null) {
            for (int i = originalMessages.size() - 1; i >= 0; i--) {
                Map<String, Object> msg = originalMessages.get(i);
                Object role = msg.get("role");
                if ("user".equals(role)) {
                    Object content = msg.get("content");
                    if (content instanceof String s) {
                        questionText = s;
                    }
                    break;
                }
            }
        }

        if (queryTexts.isEmpty() && questionText != null && !questionText.isBlank()) {
            queryTexts.add(questionText);
        }

        // Запрашиваем top-контекст из RAG по одному или нескольким запросам
        List<RagItemDto> top = queryTexts.size() > 1
                ? ragService.retrieveTopByQuestions(queryTexts)
                : ragService.retrieveTop(queryTexts.isEmpty() ? null : queryTexts.get(0));

        // Строим новое сообщение с инструкцией и Q&A
        StringBuilder ragContent = new StringBuilder();
        ragContent.append("Это дополнительная база знаний из RAG-сервиса. ");
        ragContent.append("Используй её как контекст, но не цитируй дословно, если это не нужно.\n\n");

        for (int i = 0; i < top.size(); i++) {
            RagItemDto item = top.get(i);
            ragContent.append("Вопрос: ").append(item.getQuestion() != null ? item.getQuestion() : "").append("\n");
            ragContent.append("Ответ: ").append(item.getAnswer() != null ? item.getAnswer() : "").append("\n");
            if (item.getTopic() != null) {
                ragContent.append("Тема: ").append(item.getTopic()).append("\n");
            }
            ragContent.append("\n");
        }
        if (imageAnalysisStr != null && !imageAnalysisStr.isBlank()) {
            ragContent.append("Ниже структурированный анализ приложенных скриншотов переписки:\n");
            ragContent.append(imageAnalysisStr).append("\n\n");
        }

        List<Map<String, Object>> newMessages = new ArrayList<>();

        // 1. System prompt (если первый не system — добавляем наш дефолтный)
        if (!"system".equals(originalMessages.get(0).get("role"))) {
            newMessages.add(Map.of(
                    "role", "system",
                    "content", DEFAULT_SYSTEM_PROMPT
            ));
        } else {
            newMessages.add(originalMessages.get(0));
        }

        // 2. Контекст из RAG как второе system-сообщение
        if (!top.isEmpty()) {
            newMessages.add(Map.of(
                    "role", "system",
                    "content", ragContent.toString()
            ));
        }

        // 3. Остальные сообщения (если первый был system, пропускаем его, он уже добавлен)
        int startIdx = "system".equals(originalMessages.get(0).get("role")) ? 1 : 0;
        for (int i = startIdx; i < originalMessages.size(); i++) {
            newMessages.add(originalMessages.get(i));
        }

        request.setMessages(newMessages);

        return top.stream()
                .map(RagItemDto::getQaId)
                .filter(id -> id != null)
                .collect(Collectors.toList());
    }

    private void appendImageAnalysisToLastUserMessage(List<Map<String, Object>> messages, String analysis) {
        if (messages == null || messages.isEmpty() || analysis == null || analysis.isBlank()) return;
        for (int i = messages.size() - 1; i >= 0; i--) {
            Map<String, Object> msg = messages.get(i);
            if (msg == null) continue;
            Object roleObj = msg.get("role");
            if (!"user".equals(roleObj)) continue;
            Object contentObj = msg.get("content");
            String content = contentObj instanceof String s ? s : "";
            if (content.contains("Image analysis:")) {
                return;
            }
            String merged = content
                    + "\n\nImage analysis:\n"
                    + analysis;
            msg.put("content", merged.trim());
            return;
        }
    }

    /**
     * Простой запрос к LLM без RAG с возможностью задать system prompt.
     * Возвращает только текст ответа ассистента.
     */
    @SuppressWarnings("unchecked")
    public String completeSimple(String systemPrompt, String userMessage, double temperature, int maxTokens) {
        if (!isConfigured()) {
            throw new IllegalStateException("LLM API ключ не настроен. Задайте переменную окружения LLM_API_KEY.");
        }
        List<Map<String, Object>> messages;
        if (systemPrompt != null && !systemPrompt.isBlank()) {
            messages = List.of(
                    Map.of("role", "system", "content", systemPrompt),
                    Map.of("role", "user", "content", userMessage != null ? userMessage : "")
            );
        } else {
            messages = List.of(
                    Map.of("role", "user", "content", userMessage != null ? userMessage : "")
            );
        }
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("model", defaultRewriteModel);
        body.put("temperature", temperature);
        body.put("max_tokens", maxTokens);
        body.put("messages", messages);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        ResponseEntity<String> response = restTemplate.exchange(llmUrl, HttpMethod.POST, request, String.class);
        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new RuntimeException("LLM API вернул " + response.getStatusCode());
        }
        try {
            Map<String, Object> data = new ObjectMapper().readValue(response.getBody(), Map.class);
            Object choicesObj = data.get("choices");
            if (choicesObj instanceof List<?> choices && !choices.isEmpty()) {
                Object first = choices.get(0);
                if (first instanceof Map<?, ?> choiceMap) {
                    Object msgObj = ((Map<String, Object>) choiceMap).get("message");
                    if (msgObj instanceof Map<?, ?> msgMap) {
                        Object content = ((Map<String, Object>) msgMap).get("content");
                        if (content instanceof String s) {
                            return s != null ? s.trim() : "";
                        }
                    }
                }
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse LLM response", e);
        }
        return "";
    }

    /**
     * Multimodal call: text + one or more images (as data URLs), expects plain text/JSON answer.
     */
    @SuppressWarnings("unchecked")
    public String completeMultimodalJson(String systemPrompt,
                                         String userMessage,
                                         List<String> imageDataUrls,
                                         double temperature,
                                         int maxTokens) {
        return completeMultimodalJson(systemPrompt, userMessage, imageDataUrls, temperature, maxTokens, defaultVisionModel);
    }

    @SuppressWarnings("unchecked")
    public String completeMultimodalJson(String systemPrompt,
                                         String userMessage,
                                         List<String> imageDataUrls,
                                         double temperature,
                                         int maxTokens,
                                         String model) {
        if (!isConfigured()) {
            throw new IllegalStateException("LLM API ключ не настроен. Задайте переменную окружения LLM_API_KEY.");
        }
        List<Map<String, Object>> content = new ArrayList<>();
        content.add(Map.of("type", "text", "text", userMessage != null ? userMessage : ""));
        if (imageDataUrls != null) {
            for (String dataUrl : imageDataUrls) {
                if (dataUrl == null || dataUrl.isBlank()) continue;
                content.add(Map.of("type", "image_url", "image_url", Map.of("url", dataUrl)));
            }
        }

        List<Map<String, Object>> messages = new ArrayList<>();
        if (systemPrompt != null && !systemPrompt.isBlank()) {
            messages.add(Map.of("role", "system", "content", systemPrompt));
        }
        messages.add(Map.of("role", "user", "content", content));

        Map<String, Object> body = new java.util.HashMap<>();
        body.put("model", (model != null && !model.isBlank()) ? model : defaultVisionModel);
        body.put("temperature", temperature);
        body.put("max_tokens", maxTokens);
        body.put("messages", messages);
        body.put("stream", false);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        ResponseEntity<String> response = restTemplate.exchange(llmUrl, HttpMethod.POST, request, String.class);
        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new RuntimeException("LLM API вернул " + response.getStatusCode());
        }
        try {
            Map<String, Object> data = new ObjectMapper().readValue(response.getBody(), Map.class);
            Object choicesObj = data.get("choices");
            if (choicesObj instanceof List<?> choices && !choices.isEmpty()) {
                Object first = choices.get(0);
                if (first instanceof Map<?, ?> choiceMap) {
                    Object msgObj = ((Map<String, Object>) choiceMap).get("message");
                    if (msgObj instanceof Map<?, ?> msgMap) {
                        Object contentObj = ((Map<String, Object>) msgMap).get("content");
                        if (contentObj instanceof String s) {
                            return s != null ? s.trim() : "";
                        }
                    }
                }
            }
            return "";
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse multimodal response", e);
        }
    }

    /**
     * Отправить запрос в LLM и вернуть тело ответа и список ID RAG-элементов, использованных в контексте.
     * Ключ подставляется на бэкенде, на клиент не передаётся.
     */
    public LlmCompletionResult chatCompletions(ChatCompletionsRequest request) {
        if (!isConfigured()) {
            throw new IllegalStateException("LLM API ключ не настроен. Задайте переменную окружения LLM_API_KEY.");
        }
        applyDefaults(request);
        List<Long> ragItemIds = enrichWithRagContext(request);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);
        HttpEntity<Map<String, Object>> httpEntity = new HttpEntity<>(request.toUpstreamPayload(), headers);
        ResponseEntity<String> response = restTemplate.exchange(llmUrl, HttpMethod.POST, httpEntity, String.class);
        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new RuntimeException("LLM API вернул " + (response.getStatusCode()));
        }
        return new LlmCompletionResult(response.getBody(), ragItemIds);
    }

    /**
     * Стриминговый запрос к LLM. Читает HTTP-стрим построчно и пробрасывает строки в колбэк.
     * Используется для WebSocket-стриминга.
     * Возвращает результат с полным текстом ответа и списком ragItemIds.
     */
    public LlmCompletionResult chatCompletionsStream(ChatCompletionsRequest request, Consumer<String> onLine) {
        if (!isConfigured()) {
            throw new IllegalStateException("LLM API ключ не настроен. Задайте переменную окружения LLM_API_KEY.");
        }

        request.setStream(true);
        applyDefaults(request);
        List<Long> ragItemIds = enrichWithRagContext(request);

        final StringBuilder fullText = new StringBuilder();

        Map<String, Object> outbound = request.toUpstreamPayload();
        restTemplate.execute(llmUrl, HttpMethod.POST, httpRequest -> {
            httpRequest.getHeaders().setContentType(MediaType.APPLICATION_JSON);
            httpRequest.getHeaders().setBearerAuth(apiKey);
            try (var os = httpRequest.getBody()) {
                if (os != null) {
                    com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                    mapper.writeValue(os, outbound);
                }
            }
        }, response -> {
            try (var is = response.getBody();
                 var reader = new java.io.BufferedReader(new java.io.InputStreamReader(is, StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    onLine.accept(line);
                    String chunk = extractChunkFromStreamLine(line);
                    if (chunk != null) {
                        fullText.append(chunk);
                    }
                }
            } catch (Exception e) {
                onLine.accept("ERROR:" + e.getMessage());
            }
            return null;
        });

        return new LlmCompletionResult(fullText.toString(), ragItemIds);
    }

    /**
     * Извлекает текстовый фрагмент ответа ассистента из одной строки стрима routerai/xAI.
     * Ожидаемый формат:
     *   data: { "choices": [ { "delta": { "content": "..." }, "message": { "content": "..." } } ] }
     * Возвращает только текст контента (без префикса "data:" и без служебных полей).
     */
    @SuppressWarnings("unchecked")
    private String extractChunkFromStreamLine(String line) {
        if (line == null) return null;
        String trimmed = line.trim();
        if (trimmed.isEmpty() || "[DONE]".equals(trimmed)) {
            return null;
        }

        String jsonPart = trimmed;
        if (jsonPart.startsWith("data:")) {
            jsonPart = jsonPart.substring(5).trim();
        }
        if (jsonPart.isEmpty() || "[DONE]".equals(jsonPart)) {
            return null;
        }

        try {
            ObjectMapper mapper = new ObjectMapper();
            Map<String, Object> data = mapper.readValue(jsonPart, Map.class);
            Object choicesObj = data.get("choices");
            if (!(choicesObj instanceof java.util.List<?> choices) || choices.isEmpty()) {
                return null;
            }
            Object first = choices.get(0);
            if (!(first instanceof Map<?, ?> choiceMapRaw)) {
                return null;
            }
            Map<String, Object> choiceMap = (Map<String, Object>) choiceMapRaw;

            Object deltaObj = choiceMap.get("delta");
            if (deltaObj instanceof Map<?, ?> deltaMapRaw) {
                Map<String, Object> deltaMap = (Map<String, Object>) deltaMapRaw;
                Object contentObj = deltaMap.get("content");
                // Important: keep newline/whitespace-only chunks, otherwise markdown formatting gets glued.
                if (contentObj instanceof String s) {
                    return s;
                }
            }

            Object messageObj = choiceMap.get("message");
            if (messageObj instanceof Map<?, ?> msgMapRaw) {
                Map<String, Object> msgMap = (Map<String, Object>) msgMapRaw;
                Object contentObj = msgMap.get("content");
                if (contentObj instanceof String s) {
                    return s;
                }
            }
        } catch (Exception ignored) {
        }

        return null;
    }

    /**
     * Подставляет в body значения по умолчанию для модели и параметров генерации,
     * если они не заданы клиентом, и гарантирует наличие системного промпта
     * в начале списка сообщений.
     */
    private void applyDefaults(ChatCompletionsRequest request) {
        if (request == null) {
            return;
        }
        if (request.getModel() == null || request.getModel().isBlank()) {
            request.setModel(defaultModel);
        }
        if (request.getTemperature() == null) {
            request.setTemperature(defaultTemperature);
        }
        if (request.getMaxTokens() == null) {
            request.setMaxTokens(defaultMaxTokens);
        }

        List<Map<String, Object>> messages = request.getMessages();
        if (messages == null) {
            messages = new ArrayList<>();
            request.setMessages(messages);
        } else {
            messages = new ArrayList<>(messages);
            request.setMessages(messages);
        }

        if (messages.isEmpty()) {
            Map<String, Object> systemMsg = new HashMap<>();
            systemMsg.put("role", "system");
            systemMsg.put("content", DEFAULT_SYSTEM_PROMPT);
            messages.add(systemMsg);
        } else {
            Object first = messages.get(0);
            boolean isSystem = false;
            if (first instanceof Map<?, ?> m) {
                Object role = m.get("role");
                isSystem = "system".equals(role);
            }
            if (!isSystem) {
                Map<String, Object> systemMsg = new HashMap<>();
                systemMsg.put("role", "system");
                systemMsg.put("content", DEFAULT_SYSTEM_PROMPT);
                messages.add(0, systemMsg);
            }
        }
    }
}

