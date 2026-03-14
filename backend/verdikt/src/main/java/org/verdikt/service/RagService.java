package org.verdikt.service;

import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.verdikt.dto.RagItemDto;
import org.verdikt.dto.RagResponseDto;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Сервис для обращения к внешней RAG-системе verdikt-gpt.online.
 * Берёт вопрос пользователя и возвращает список релевантных Q&A,
 * которые затем добавляются в prompt LLM как контекст.
 */
@Service
public class RagService {

    private static final String RAG_URL = "https://verdikt-gpt.online/api/retrieve";
    private static final String SECRET_HEADER = "X-Secret-Phrase";
    private static final String SECRET_VALUE = "1q2w3e$R%T^Y";

    private final RestTemplate restTemplate = new RestTemplate();

    public List<RagItemDto> retrieveTop(String question) {
        if (question == null || question.isBlank()) {
            return Collections.emptyList();
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set(SECRET_HEADER, SECRET_VALUE);

        Map<String, Object> requestBody = Map.of("question", question);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
        ResponseEntity<RagResponseDto> response = restTemplate.exchange(
                RAG_URL,
                HttpMethod.POST,
                entity,
                RagResponseDto.class
        );

        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            return Collections.emptyList();
        }

        List<RagItemDto> top = response.getBody().getTop();
        return top != null ? top : Collections.emptyList();
    }
}

