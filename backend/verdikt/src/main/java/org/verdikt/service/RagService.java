package org.verdikt.service;

import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.verdikt.dto.RagItemDto;
import org.verdikt.dto.RagResponseDto;

import java.util.ArrayList;
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
    private static final String RAG_TOP_URL = "https://verdikt-gpt.online/api/retrieve-top";
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

    @SuppressWarnings("unchecked")
    public List<RagItemDto> retrieveTopByQuestions(List<String> queries) {
        if (queries == null || queries.isEmpty()) {
            return Collections.emptyList();
        }
        List<String> normalized = queries.stream()
                .filter(q -> q != null && !q.isBlank())
                .map(String::trim)
                .limit(4)
                .toList();
        if (normalized.isEmpty()) {
            return Collections.emptyList();
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set(SECRET_HEADER, SECRET_VALUE);

        Map<String, Object> requestBody = Map.of("queries", normalized);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

        ResponseEntity<Object> response = restTemplate.exchange(
                RAG_TOP_URL,
                HttpMethod.POST,
                entity,
                Object.class
        );
        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            return Collections.emptyList();
        }

        Object body = response.getBody();
        List<RagItemDto> out = new ArrayList<>();
        if (body instanceof Map<?, ?> m) {
            // New retrieve-top shape:
            // { totalDocuments: number, results: [ { query: "...", documents: [ScoredQa...] } ] }
            Object resultsObj = m.get("results");
            if (resultsObj instanceof List<?> results) {
                for (Object resultItem : results) {
                    if (!(resultItem instanceof Map<?, ?> resultMap)) continue;
                    Object documentsObj = resultMap.get("documents");
                    if (!(documentsObj instanceof List<?> docs)) continue;
                    for (Object doc : docs) {
                        if (doc instanceof Map<?, ?> row) {
                            RagItemDto dto = toDto((Map<String, Object>) row);
                            if (dto != null) out.add(dto);
                        }
                    }
                }
            }

            // Backward compatibility for older shape: { top: [...] }
            if (out.isEmpty()) {
                Object topObj = m.get("top");
                if (topObj instanceof List<?> list) {
                    for (Object item : list) {
                        if (item instanceof Map<?, ?> row) {
                            RagItemDto dto = toDto((Map<String, Object>) row);
                            if (dto != null) out.add(dto);
                        }
                    }
                }
            }
        } else if (body instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> row) {
                    RagItemDto dto = toDto((Map<String, Object>) row);
                    if (dto != null) out.add(dto);
                }
            }
        }
        return out;
    }

    private RagItemDto toDto(Map<String, Object> row) {
        if (row == null) return null;
        RagItemDto dto = new RagItemDto();
        Object qaId = row.get("qaId");
        if (qaId instanceof Number n) dto.setQaId(n.longValue());
        else if (qaId instanceof String s) {
            try { dto.setQaId(Long.parseLong(s)); } catch (Exception ignored) {}
        }
        Object question = row.get("question");
        if (question instanceof String s) dto.setQuestion(s);
        Object answer = row.get("answer");
        if (answer instanceof String s) dto.setAnswer(s);
        Object topic = row.get("topic");
        if (topic instanceof String s) dto.setTopic(s);
        Object score = row.get("score");
        if (score instanceof Number n) dto.setScore(n.doubleValue());
        else if (score instanceof String s) {
            try { dto.setScore(Double.parseDouble(s)); } catch (Exception ignored) {}
        }
        return dto;
    }
}

