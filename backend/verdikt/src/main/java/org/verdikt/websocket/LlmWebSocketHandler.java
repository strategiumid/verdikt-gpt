package org.verdikt.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.verdikt.service.LlmProxyService;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * WebSocket-обработчик для стриминга ответов LLM.
 * Клиент присылает JSON-тело такого же формата, как в /api/chat/completions,
 * а сервер открывает стрим к LLM и построчно пересылает данные обратно по WebSocket.
 */
@Component
public class LlmWebSocketHandler extends TextWebSocketHandler {

    private final LlmProxyService llmProxyService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public LlmWebSocketHandler(LlmProxyService llmProxyService) {
        this.llmProxyService = llmProxyService;
    }

    @Override
    public void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            Map body = objectMapper.readValue(message.getPayload(), Map.class);

            // Запускаем стриминг в отдельном потоке, чтобы не блокировать обработчик WebSocket
            CompletableFuture.runAsync(() -> {
                try {
                    llmProxyService.chatCompletionsStream(body, line -> {
                        try {
                            if (session.isOpen()) {
                                session.sendMessage(new TextMessage(line));
                            }
                        } catch (Exception e) {
                            // Игнорируем дальнейшие ошибки отправки при обрыве соединения
                        }
                    });
                } catch (Exception e) {
                    try {
                        if (session.isOpen()) {
                            session.sendMessage(new TextMessage("ERROR:" + e.getMessage()));
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
            });

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
}

