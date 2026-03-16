package org.verdikt.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.verdikt.entity.ChatMessage;
import org.verdikt.entity.User;
import org.verdikt.repository.ChatMessageRepository;
import org.verdikt.service.ChatHistoryService;
import org.verdikt.service.LlmProxyService;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * WebSocket-обработчик для стриминга ответов LLM.
 * Клиент присылает DTO формата { \"message\": \"...\", \"chatId\": \"uuid\" }.
 * Бэкенд восстанавливает последние сообщения чата из БД, добавляет новое
 * сообщение пользователя, обогащает запрос системным промптом и RAG-контекстом
 * и стримит ответ LLM обратно по WebSocket, параллельно сохраняя историю чата.
 */
@Component
public class LlmWebSocketHandler extends TextWebSocketHandler {

    private final LlmProxyService llmProxyService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ChatMessageRepository chatMessageRepository;
    private final ChatHistoryService chatHistoryService;

    private static final int MAX_MESSAGES_TOTAL = 10;
    private static final int MAX_MESSAGES_PER_ROLE = 5;

    public LlmWebSocketHandler(LlmProxyService llmProxyService,
                               ChatMessageRepository chatMessageRepository,
                               ChatHistoryService chatHistoryService) {
        this.llmProxyService = llmProxyService;
        this.chatMessageRepository = chatMessageRepository;
        this.chatHistoryService = chatHistoryService;
    }

    /**
     * DTO, которое присылает фронтенд по WebSocket:
     * { \"message\": \"...\", \"chatId\": \"uuid\" }
     */
    public static class StreamRequestDto {
        public String message;
        public String chatId;
    }

    @Override
    public void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            User user = getCurrentUser(session);
            if (user == null) {
                if (session.isOpen()) {
                    session.sendMessage(new TextMessage("ERROR:UNAUTHORIZED"));
                    session.close(CloseStatus.POLICY_VIOLATION);
                }
                return;
            }

            StreamRequestDto dto = objectMapper.readValue(message.getPayload(), StreamRequestDto.class);
            Map<String, Object> body = buildRequestBodyFromDto(dto);

            // Запускаем стриминг в отдельном потоке, чтобы не блокировать обработчик WebSocket
            CompletableFuture.runAsync(() -> streamAndPersist(session, body, user, dto.chatId));

        } catch (Exception e) {
            try {
                if (session.isOpen()) {
                    session.sendMessage(new TextMessage("ERROR:" + e.getMessage()));
                    session.close(CloseStatus.SERVER_ERROR);
                }
            } catch (Exception ignored) {
            }
        }
    }

    private void streamAndPersist(WebSocketSession session, Map<String, Object> body, User user, String userChatId) {
        try {
            boolean isNewChat = (userChatId == null || userChatId.isBlank());

            var completionResult = llmProxyService.chatCompletionsStream(body, line -> {
                try {
                    if (session.isOpen()) {
                        session.sendMessage(new TextMessage(line));
                    }
                } catch (Exception ignored) {
                    // Игнорируем дальнейшие ошибки отправки при обрыве соединения
                }
            });

            String chatId = null;
            String fullText = completionResult != null ? completionResult.getResponseBody() : null;
            java.util.List<Long> ragItemIds = completionResult != null ? completionResult.getRagItemIds() : java.util.List.of();

            if (user != null && fullText != null && !fullText.isBlank()) {
                Map<String, Object> llmResult = new HashMap<>();
                llmResult.put("content", fullText);
                chatId = chatHistoryService.saveFromCompletion(user, body, llmResult, ragItemIds);
            }
            saveDebugBody(body, chatId);

            // Для уже существующих чатов фронтенд и так знает chatId,
            // поэтому отправляем его только для новых чатов.
            if (isNewChat && chatId != null && session.isOpen()) {
                // Сохраняем тело запроса для отладки (формат JSON)

                Map<String, Object> chatIdMessage = new HashMap<>();
                chatIdMessage.put("type", "chatId");
                chatIdMessage.put("chatId", chatId);
                session.sendMessage(new TextMessage(objectMapper.writeValueAsString(chatIdMessage)));
            }
        } catch (Exception e) {
            try {
                if (session.isOpen()) {
                    session.sendMessage(new TextMessage("ERROR:" + e.getMessage()));
                    session.close(CloseStatus.SERVER_ERROR);
                }
            } catch (Exception ignored) {
            }
        } finally {
            try {
                if (session.isOpen()) {
                    session.close(CloseStatus.NORMAL);
                }
            } catch (Exception ignored) {
            }
        }
    }

    /**
     * Сохраняет тело запроса к LLM в JSON-файл для отладки.
     * Файлы кладутся в backend/verdikt/src/main/resources/debug/ws-chat-*.json.
     */
    private void saveDebugBody(Map<String, Object> body, String chatId) {
        try {
            if (body == null) return;
            Path dir = Paths.get("backend/verdikt/src/main/resources/debug");
            Files.createDirectories(dir);
            String fileName = "ws-chat-" + (chatId != null ? chatId : "nochat") + "-" + Instant.now().toEpochMilli() + ".json";
            Path file = dir.resolve(fileName);
            String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(body);
            Files.writeString(file, json);
        } catch (Exception e) {
            System.out.println(e.getMessage());
        }
    }

    private User getCurrentUser(WebSocketSession session) {
        if (session == null || session.getPrincipal() == null) {
            return null;
        }
    
        Object principal = session.getPrincipal();
    
        if (principal instanceof User u) {
            return u;
        }
    
        if (principal instanceof Authentication authentication) {
            Object authPrincipal = authentication.getPrincipal();
            if (authPrincipal instanceof User u) {
                return u;
            }
        }
    
        return null;
    }

    /**
     * Собирает тело запроса к LLM из DTO:
     * - загружает из БД последние N сообщений чата (по chatId), если он есть;
     * - добавляет новое пользовательское сообщение из dto.message;
     * - устанавливает поле chatId, чтобы LLM-прокси мог сохранить историю при необходимости.
     * System prompt и RAG-контекст добавляются внутри LlmProxyService.enrichWithRagContext.
     */
    private Map<String, Object> buildRequestBodyFromDto(StreamRequestDto dto) {
        Map<String, Object> body = new HashMap<>();
        List<Map<String, Object>> messages = new ArrayList<>();

        if (dto != null && dto.chatId != null && !dto.chatId.isBlank()) {
            messages.addAll(loadRecentMessages(dto.chatId));
            body.put("chatId", dto.chatId);
        }

        // Текущее пользовательское сообщение
        if (dto != null && dto.message != null && !dto.message.isBlank()) {
            Map<String, Object> userMsg = new HashMap<>();
            userMsg.put("role", "user");
            userMsg.put("content", dto.message);
            messages.add(userMsg);
        }

        body.put("messages", messages);
        return body;
    }

    /**
     * Загружает недавние сообщения чата и ограничивает их максимум
     * 10-ю сообщениями (по 5 user и assistant, если возможно), в хронологическом порядке.
     */
    private List<Map<String, Object>> loadRecentMessages(String chatId) {
        List<ChatMessage> recent = chatMessageRepository
                .findTop10ByChat_ChatKeyOrderByIdDesc(chatId);

        List<ChatMessage> limited = new ArrayList<>();
        int userCount = 0;
        int assistantCount = 0;

        for (ChatMessage m : recent) {
            if (limited.size() >= MAX_MESSAGES_TOTAL) break;
            String role = m.getRole();
            if ("user".equals(role)) {
                if (userCount >= MAX_MESSAGES_PER_ROLE) continue;
                userCount++;
            } else if ("assistant".equals(role)) {
                if (assistantCount >= MAX_MESSAGES_PER_ROLE) continue;
                assistantCount++;
            }
            limited.add(m);
        }

        Collections.reverse(limited);
        List<Map<String, Object>> result = new ArrayList<>(limited.size());
        for (ChatMessage m : limited) {
            Map<String, Object> msg = new HashMap<>();
            msg.put("role", m.getRole());
            msg.put("content", m.getContent());
            result.add(msg);
        }
        return result;
    }
}

