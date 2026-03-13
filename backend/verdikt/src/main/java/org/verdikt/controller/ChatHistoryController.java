package org.verdikt.controller;

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

