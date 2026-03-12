package org.verdikt.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.verdikt.websocket.LlmWebSocketHandler;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final LlmWebSocketHandler llmWebSocketHandler;

    public WebSocketConfig(LlmWebSocketHandler llmWebSocketHandler) {
        this.llmWebSocketHandler = llmWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(llmWebSocketHandler, "/ws/llm")
                .setAllowedOriginPatterns("*");
    }
}

