package org.verdikt.controller;

import org.verdikt.dto.ChatMessagesPageResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.verdikt.entity.User;
import org.verdikt.service.ChatHistoryService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chats")
public class ChatHistoryController {

    private final ChatHistoryService chatHistoryService;

    public ChatHistoryController(ChatHistoryService chatHistoryService) {
        this.chatHistoryService = chatHistoryService;
    }

    @GetMapping
    public List<Map<String, Object>> list(@AuthenticationPrincipal User user) {
        return chatHistoryService.getChats(user);
    }

    @GetMapping("/{chatId}")
    public Map<String, Object> get(
            @AuthenticationPrincipal User user,
            @PathVariable String chatId
    ) {
        return chatHistoryService.getChat(user, chatId);
    }

    /**
     * Пагинированный список сообщений чата. Доступ только у владельца чата или админа.
     * Админ может передать query-параметр userId, чтобы получить сообщения чата другого пользователя.
     */
    @GetMapping("/{chatId}/messages")
    public ChatMessagesPageResponse getMessages(
            @AuthenticationPrincipal User user,
            @PathVariable String chatId,
            @RequestParam(required = false) Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        if (size < 1) size = 1;
        if (size > 100) size = 100;
        return chatHistoryService.getMessages(user, chatId, userId, PageRequest.of(page, size));
    }

    @PutMapping("/{chatId}")
    public ResponseEntity<Map<String, Object>> save(
            @AuthenticationPrincipal User user,
            @PathVariable String chatId,
            @RequestBody Map<String, Object> payload
    ) {
        Map<String, Object> result = chatHistoryService.saveChat(user, chatId, payload);
        return ResponseEntity.status(HttpStatus.OK).body(result);
    }

    @DeleteMapping("/{chatId}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal User user,
            @PathVariable String chatId
    ) {
        chatHistoryService.deleteChat(user, chatId);
        return ResponseEntity.noContent().build();
    }
}

