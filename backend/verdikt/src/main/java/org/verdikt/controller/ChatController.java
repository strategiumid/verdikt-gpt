package org.verdikt.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.web.server.ResponseStatusException;

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
            @RequestBody Map<String, Object> body
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
        // REST-эндпоинт всегда работает в нестриминговом режиме
        body.put("stream", false);

        String responseBody = llmProxyService.chatCompletions(body);
        userService.incrementAiRequests(user.getId());
        try {
            Map<String, Object> result = objectMapper.readValue(responseBody, new TypeReference<Map<String, Object>>() {});

            String effectiveChatId = chatHistoryService.saveFromCompletion(user, body, result);
            if (effectiveChatId != null) {
                result.put("chatId", effectiveChatId);
            }

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Ошибка формата ответа LLM");
        }
    }
}
