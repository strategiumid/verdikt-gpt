package org.verdikt.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.verdikt.service.RateLimitService;

import java.io.IOException;
import java.util.Map;

/**
 * Ограничение попыток логина и регистрации с одного IP (защита от брутфорса).
 * Срабатывает только для POST /api/auth/login и POST /api/auth/register.
 */
@Component
public class AuthRateLimitFilter extends OncePerRequestFilter {

    private final RateLimitService rateLimitService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AuthRateLimitFilter(RateLimitService rateLimitService) {
        this.rateLimitService = rateLimitService;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        String path = request.getRequestURI();
        if (!"POST".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }
        String clientIp = getClientIp(request);
        RateLimitService.Result result;
        if (path != null && path.endsWith("/login")) {
            result = rateLimitService.tryLogin(clientIp);
        } else if (path != null && path.endsWith("/register")) {
            result = rateLimitService.tryRegister(clientIp);
        } else {
            filterChain.doFilter(request, response);
            return;
        }

        if (!result.allowed()) {
            response.setStatus(429); // Too Many Requests
            response.setContentType("application/json;charset=UTF-8");
            int minutes = (result.retryAfterSeconds() + 59) / 60;
            String message = minutes > 0
                    ? "Слишком много попыток. Попробуйте через " + minutes + " мин."
                    : "Слишком много попыток. Попробуйте позже.";
            response.getWriter().write(objectMapper.writeValueAsString(Map.of(
                    "message", message,
                    "retryAfterSeconds", result.retryAfterSeconds()
            )));
            return;
        }
        filterChain.doFilter(request, response);
    }

    private String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "unknown";
    }
}
