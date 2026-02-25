package org.verdikt.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.verdikt.service.ReplayNonceStore;

import java.io.IOException;
import java.util.Map;

/**
 * Защита от replay: проверка X-Nonce и X-Timestamp для запросов к /api/**.
 * Требует уникальный nonce и метку времени в допустимом окне.
 * Применяется в т.ч. к чувствительным операциям: обновление подписки (PATCH /api/users/me/subscription,
 * PATCH /api/admin/users/{id}/subscription) и использование AI (POST /api/users/me/usage/increment).
 */
@Component
public class ReplayProtectionFilter extends OncePerRequestFilter {

    private final ReplayNonceStore nonceStore;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${app.replay.enabled:true}")
    private boolean enabled;

    @Value("${app.replay.window-seconds:300}")
    private int windowSeconds;

    public ReplayProtectionFilter(ReplayNonceStore nonceStore) {
        this.nonceStore = nonceStore;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        if (!enabled) {
            filterChain.doFilter(request, response);
            return;
        }
        String path = request.getRequestURI();
        if (path == null || !path.startsWith("/api/")) {
            filterChain.doFilter(request, response);
            return;
        }

        String nonce = request.getHeader("X-Nonce");
        String timestampHeader = request.getHeader("X-Timestamp");

        if (nonce == null || nonce.isBlank() || timestampHeader == null || timestampHeader.isBlank()) {
            sendReplayError(response, 400, "X-Nonce и X-Timestamp обязательны");
            return;
        }

        long requestTime;
        try {
            requestTime = Long.parseLong(timestampHeader.trim());
        } catch (NumberFormatException e) {
            sendReplayError(response, 400, "Некорректная метка времени");
            return;
        }

        long now = System.currentTimeMillis();
        long windowMs = windowSeconds * 1000L;
        if (requestTime < now - windowMs || requestTime > now + windowMs) {
            sendReplayError(response, 401, "Метка времени вне допустимого окна");
            return;
        }

        if (!nonceStore.tryUse(nonce)) {
            sendReplayError(response, 409, "Повторное использование запроса");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private void sendReplayError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(objectMapper.writeValueAsString(Map.of("message", message)));
    }
}
