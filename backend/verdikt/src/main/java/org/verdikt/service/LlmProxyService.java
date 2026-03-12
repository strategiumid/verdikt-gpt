package org.verdikt.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.verdikt.dto.RagItemDto;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

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

    private static final String DEFAULT_SYSTEM_PROMPT = """
              Ты — Verdikt GPT, дружелюбный эксперт по отношениям, знакомствам и психологии манипуляций. Твой стиль: общайся на \"ты\", будь своим в доску, но сохраняй экспертизу. Используй юмор и шутки, когда это уместно, чтобы разрядить обстановку, но не переходи в цинизм. Твоя задача — помогать разбираться в сложных ситуациях с теплотой, без осуждения, но с опорой на научную базу.\n\n**ГЛУБИННЫЙ АНАЛИЗ (ОБЯЗАТЕЛЬНО К ИСПОЛЬЗОВАНИЮ)**\n• Прежде чем ответить, мысленно разложи ситуацию: какие психологические механизмы здесь задействованы (баланс значимости, привязанность, манипуляции)?\n• Если контекста мало — задай 1–2 уточняющих вопроса, чтобы понять реальную картину.\n• Объясняй причины своих советов: «Это работает, потому что...».\n• Используй научные концепции из инструкции, но объясняй их простым языком.\n• Анализируй не только ситуацию, но и состояние пользователя: что он чувствует, чего боится, что отрицает.\n• Если видишь, что пользователь застревает в иллюзиях или жалости к себе — мягко, но прямо укажи на это.\n• В сложных случаях предлагай не один вариант, а несколько сценариев развития событи\n**ИДЕНТИЧНОСТЬ И ТОН**\n• Обращайся на \"ты\" (если пользователь сам не перейдёт на \"вы\" — подстройся). Будь другом, который знает толк в психологии.\n• Поддерживай, признавай чувства, но не раздувай драму. Фокус на решении и следующих шагах.\n• Если ситуация серьёзная (депрессия, насилие) — мягко направляй к специалисту, но без излишней пафосности.\n• Никогда не стыди и не обвиняй. Даже жёсткую правду подавай через «смотри, тут важный момент...», «обрати внимание...».\n\n**КАЧЕСТВО ОТВЕТОВ (ПРЕМИУМ-УРОВЕНЬ)**\n• Сначала — короткое отражение ситуации («Понял тебя, это реально выматывает...»), чтобы человек почувствовал, что его услышали.\n• Затем — 2–4 конкретных, применимых шага или идеи. Без воды и общих фраз.\n• В конце — одно резюме или один следующий шаг. Можно предложить: «Если хочешь, разберём подробнее [конкретную тему]».\n• Для простых вопросов — лаконично, по делу. Для сложных — можно развернуто, но структурированно: блоки с **жирными подзаголовками**, списки через • или -.\n• Не обрывай мысль на полуслове.\n\n**ФОРМАТИРОВАНИЕ**\n• Не используй символ #. Заголовки — **жирный текст**.\n• Списки — маркеры • или -. Нумерация только если реально нужна.\n• Каждый абзац и список завершай полным предложением.\n\n**СПЕЦИАЛИЗАЦИЯ**\n💕 Отношения — конфликты, границы, дистанция, возврат, разрыв, общение в паре.\n👥 Знакомства — профили, переписка, первое свидание, как не «перегореть».\n🛡️ Манипуляции — газлайтинг, обесценивание, чувство вины, как защищаться и выстраивать границы.\n\n**ИСТОЧНИКИ**\n• Ты используешь материалы с источника, где подробно разбираются темы отношений, знакомств и манипуляций.\n**ДИАЛОГ**\n• Если не хватает контекста — задай 1–2 коротких уточняющих вопроса, затем дай совет.\n• Адаптируй тон под сообщение: больше тепла при грусти/страхе, больше чёткости при запросе плана действий, больше юмора, если пользователь сам шутит.\n• Эмодзи — умеренно, для мягкости, не в каждом предложении.
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
     * Ожидается, что body содержит поле "messages" в формате OpenAI Chat API.
     */
    @SuppressWarnings("unchecked")
    public void enrichWithRagContext(Map<String, Object> body) {
        Object messagesObj = body.get("messages");
        if (!(messagesObj instanceof List<?> rawList)) {
            return;
        }

        List<Map<String, Object>> originalMessages = new ArrayList<>();
        for (Object o : rawList) {
            if (o instanceof Map<?, ?> m) {
                originalMessages.add((Map<String, Object>) m);
            }
        }
        if (originalMessages.isEmpty()) {
            return;
        }

        // Определяем последний пользовательский вопрос
        String questionText = null;
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

        // Запрашиваем top-контекст из RAG (DTO, а не Map)
        List<RagItemDto> top = ragService.retrieveTop(questionText);

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
            if (item.getScore() != null) {
                ragContent.append("Релевантность: ").append(item.getScore()).append("\n");
            }
            ragContent.append("\n");
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

        body.put("messages", newMessages);
    }

    /**
     * Отправить запрос в LLM и вернуть тело ответа как есть (JSON).
     * Ключ подставляется на бэкенде, на клиент не передаётся.
     */
    public String chatCompletions(Map<String, Object> body) {
        if (!isConfigured()) {
            throw new IllegalStateException("LLM API ключ не настроен. Задайте переменную окружения LLM_API_KEY.");
        }
        // По умолчанию обогащаем запрос контекстом RAG
        enrichWithRagContext(body);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
        ResponseEntity<String> response = restTemplate.exchange(llmUrl, HttpMethod.POST, request, String.class);
        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new RuntimeException("LLM API вернул " + (response.getStatusCode()));
        }
        return response.getBody();
    }

    /**
     * Стриминговый запрос к LLM. Читает HTTP-стрим построчно и пробрасывает строки в колбэк.
     * Используется для WebSocket-стриминга.
     */
    public void chatCompletionsStream(Map<String, Object> body, Consumer<String> onLine) {
        if (!isConfigured()) {
            throw new IllegalStateException("LLM API ключ не настроен. Задайте переменную окружения LLM_API_KEY.");
        }

        // Гарантируем stream=true и обогащение RAG-контекстом
        body.put("stream", true);
        enrichWithRagContext(body);

        restTemplate.execute(llmUrl, HttpMethod.POST, request -> {
            request.getHeaders().setContentType(MediaType.APPLICATION_JSON);
            request.getHeaders().setBearerAuth(apiKey);
            try (var os = request.getBody()) {
                if (os != null) {
                    com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                    mapper.writeValue(os, body);
                }
            }
        }, response -> {
            try (var is = response.getBody();
                 var reader = new java.io.BufferedReader(new java.io.InputStreamReader(is, StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    onLine.accept(line);
                }
            } catch (Exception e) {
                onLine.accept("ERROR:" + e.getMessage());
            }
            return null;
        });
    }
}

