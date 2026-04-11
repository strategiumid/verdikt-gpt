package org.verdikt.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.verdikt.dto.ChatCompletionsRequest;
import org.verdikt.dto.LlmCompletionResult;
import org.verdikt.dto.UsageResponse;
import org.verdikt.entity.User;
import org.verdikt.service.ChatHistoryService;
import org.verdikt.service.LlmProxyService;
import org.verdikt.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.Map;

/**
 * Прокси запросов к LLM. Ключ хранится на бэкенде (LLM_API_KEY).
 * POST /api/chat/completions — авторизованный пользователь, проверка лимита, вызов LLM, инкремент usage.
 */
@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final LlmProxyService llmProxyService;
    private final UserService userService;
    private final ChatHistoryService chatHistoryService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ChatController(LlmProxyService llmProxyService, UserService userService, ChatHistoryService chatHistoryService) {
        this.llmProxyService = llmProxyService;
        this.userService = userService;
        this.chatHistoryService = chatHistoryService;
    }

    @PostMapping(value = "/completions", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> completions(
            @AuthenticationPrincipal User user,
            @RequestBody ChatCompletionsRequest request
    ) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Войдите в аккаунт");
        }
        UsageResponse usage = userService.getUsage(user.getId());
        if (usage.getUsed() >= usage.getLimit()) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Исчерпан лимит запросов на этот месяц. Обновите план подписки.");
        }
        if (!llmProxyService.isConfigured()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("message", "LLM API ключ не настроен. Задайте переменную окружения LLM_API_KEY на сервере."));
        }
        request.setStream(false);

        LlmCompletionResult completionResult = llmProxyService.chatCompletions(request);
        userService.incrementAiRequests(user.getId());
        try {
            Map<String, Object> result = objectMapper.readValue(completionResult.getResponseBody(), new TypeReference<Map<String, Object>>() {});

            ChatHistoryService.CompletionSaveResult saved =
                    chatHistoryService.saveFromCompletion(user, request, result, completionResult.getRagItemIds(), null);
            if (saved.chatId() != null) {
                result.put("chatId", saved.chatId());
            }

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Ошибка формата ответа LLM");
        }
    }

    @PostMapping(value = "/transcriptions", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> transcribeAudio(
            @AuthenticationPrincipal User user,
            @RequestPart("file") MultipartFile file
    ) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Войдите в аккаунт");
        }
        UsageResponse usage = userService.getUsage(user.getId());
        if (usage.getUsed() >= usage.getLimit()) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Исчерпан лимит запросов на этот месяц. Обновите план подписки.");
        }
        if (!llmProxyService.isConfigured()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("message", "LLM API ключ не настроен. Задайте переменную окружения LLM_API_KEY на сервере."));
        }
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Аудиофайл обязателен");
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.toLowerCase().startsWith("audio/")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Поддерживаются только audio/* файлы");
        }
        try {
            LlmProxyService.TranscriptionResult result =
                    llmProxyService.transcribeAudio(file.getBytes(), contentType);
            userService.incrementAiRequests(user.getId());
            return ResponseEntity.ok(Map.of(
                    "text", result.text(),
                    "model", result.model()
            ));
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Не удалось прочитать аудиофайл");
        }
    }
}
