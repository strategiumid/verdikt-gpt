package org.verdikt.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.verdikt.dto.VerdiktModelType;
import org.verdikt.entity.User;
import org.verdikt.service.ChatHistoryService;
import org.verdikt.service.ChatOrchestratorService;
import org.verdikt.service.LlmProxyService;
import org.verdikt.service.OrchestratorResult;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

/**
 * WebSocket handler for streaming LLM responses.
 * Client sends: { "message": "...", "chatId": "uuid", "selectedTopicId": "topic_2" } (optional).
 * Pipeline: topic routing → rewrite (turn 2+) → RAG retrieval → stream → persist.
 */
@Component
public class LlmWebSocketHandler extends TextWebSocketHandler {

    private final LlmProxyService llmProxyService;
    private final ChatHistoryService chatHistoryService;
    private final ChatOrchestratorService chatOrchestratorService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public LlmWebSocketHandler(LlmProxyService llmProxyService,
                               ChatHistoryService chatHistoryService,
                               ChatOrchestratorService chatOrchestratorService) {
        this.llmProxyService = llmProxyService;
        this.chatHistoryService = chatHistoryService;
        this.chatOrchestratorService = chatOrchestratorService;
    }

    /**
     * DTO from frontend: { "message": "...", "chatId": "uuid", "selectedTopicId": "topic_2" } (optional).
     */
    public static class StreamRequestDto {
        public String message;
        public String chatId;
        public String selectedTopicId;
        /** If true, this chat is persisted as private and hidden from chat history list. */
        public Boolean isPrivate;
        /** {@code verdikt-chat} | {@code verdikt-reasoner} | {@code verdikt-auto}; по умолчанию chat. */
        public VerdiktModelType modelType;
        public List<AttachmentDto> attachments;
    }

    public static class AttachmentDto {
        public String type;
        public String imageId;
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
            if (!user.isEmailVerified()) {
                if (session.isOpen()) {
                    session.sendMessage(new TextMessage("ERROR:EMAIL_NOT_VERIFIED"));
                    session.close(CloseStatus.POLICY_VIOLATION);
                }
                return;
            }

            StreamRequestDto dto = objectMapper.readValue(message.getPayload(), StreamRequestDto.class);
            String userMessage = dto != null ? dto.message : null;
            if (dto == null || userMessage == null || userMessage.isBlank()) {
                if (session.isOpen()) {
                    session.sendMessage(new TextMessage("ERROR:Message is required"));
                }
                return;
            }
            dto.message = userMessage;

            CompletableFuture.runAsync(() -> processTurn(session, user, dto));
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

    private void processTurn(WebSocketSession session, User user, StreamRequestDto dto) {
        try {
            VerdiktModelType modelType = dto.modelType != null ? dto.modelType : VerdiktModelType.VERDIKT_CHAT;
            OrchestratorResult result = chatOrchestratorService.processTurn(
                    user, dto.chatId, dto.message, dto.selectedTopicId, extractImageIds(dto.attachments), modelType);

            if (result instanceof OrchestratorResult.ChooseTopic choose) {
                if (session.isOpen()) {
                    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(choose.response())));
                    session.close(CloseStatus.NORMAL);
                }
                return;
            }

            OrchestratorResult.Stream stream = (OrchestratorResult.Stream) result;
            boolean isNewChat = (dto.chatId == null || dto.chatId.isBlank());

            var completionResult = llmProxyService.chatCompletionsStream(stream.request(), line -> {
                try {
                    if (session.isOpen()) {
                        session.sendMessage(new TextMessage(line));
                    }
                } catch (Exception ignored) {
                }
            });

            String fullText = completionResult != null ? completionResult.getResponseBody() : null;
            List<Long> ragItemIds = completionResult != null ? completionResult.getRagItemIds() : List.of();

            if (user != null && fullText != null && !fullText.isBlank()) {
                var updatedState = chatOrchestratorService.finishTurn(stream, fullText, ragItemIds);
                Map<String, Object> llmResult = new HashMap<>();
                llmResult.put("content", fullText);
                boolean isPrivate = dto.isPrivate != null && dto.isPrivate;
                ChatHistoryService.CompletionSaveResult saved = chatHistoryService.saveFromCompletion(
                        user, stream.request(), llmResult, ragItemIds, updatedState, stream.skipUserMessage(), isPrivate);
                String chatId = saved.chatId();

                if (chatId != null && session.isOpen()) {
                    Map<String, Object> chatIdMessage = new HashMap<>();
                    chatIdMessage.put("type", "chatId");
                    chatIdMessage.put("chatId", chatId);
                    chatIdMessage.put("assistantMessageId", saved.assistantMessageId());
                    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(chatIdMessage)));
                }
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

    private List<String> extractImageIds(List<AttachmentDto> attachments) {
        if (attachments == null || attachments.isEmpty()) return List.of();
        return attachments.stream()
                .filter(a -> a != null && "image".equalsIgnoreCase(a.type) && a.imageId != null && !a.imageId.isBlank())
                .map(a -> a.imageId.trim())
                .distinct()
                .collect(Collectors.toList());
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
}
