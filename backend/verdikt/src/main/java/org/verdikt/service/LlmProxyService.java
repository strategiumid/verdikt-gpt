package org.verdikt.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * Прокси к LLM API (routerai.ru). Ключ хранится только на бэкенде (llm.api-key).
 */
@Service
public class LlmProxyService {

    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${llm.api-key:}")
    private String apiKey;

    @Value("${llm.url:https://routerai.ru/api/v1/chat/completions}")
    private String llmUrl;

    /** Ключ настроен (задан через LLM_API_KEY). */
    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    /**
     * Отправить запрос в LLM и вернуть тело ответа как есть (JSON).
     * Ключ подставляется на бэкенде, на клиент не передаётся.
     */
    public String chatCompletions(Map<String, Object> body) {
        if (!isConfigured()) {
            throw new IllegalStateException("LLM API ключ не настроен. Задайте переменную окружения LLM_API_KEY.");
        }
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
}
