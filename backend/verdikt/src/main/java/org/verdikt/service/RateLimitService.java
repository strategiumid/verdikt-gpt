package org.verdikt.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;

/**
 * Ограничение числа попыток с одного IP (логин, регистрация).
 * In-memory: счётчик попыток в скользящем окне по времени.
 */
@Service
public class RateLimitService {

    @Value("${app.rate-limit.login.max-attempts:5}")
    private int loginMaxAttempts;

    @Value("${app.rate-limit.login.window-seconds:300}")
    private int loginWindowSeconds;

    @Value("${app.rate-limit.register.max-attempts:3}")
    private int registerMaxAttempts;

    @Value("${app.rate-limit.register.window-seconds:3600}")
    private int registerWindowSeconds;

    private final ConcurrentHashMap<String, Window> store = new ConcurrentHashMap<>();

    public record Result(boolean allowed, int retryAfterSeconds) {}

    private static final class Window {
        int count;
        long windowStartMillis;

        Window() {
            this.count = 0;
            this.windowStartMillis = System.currentTimeMillis();
        }
    }

    /** Проверка лимита для логина. При превышении — allowed=false, retryAfterSeconds — через сколько можно снова. */
    public Result tryLogin(String clientIp) {
        return tryConsume("login:" + clientIp, loginMaxAttempts, loginWindowSeconds);
    }

    /** Проверка лимита для регистрации. */
    public Result tryRegister(String clientIp) {
        return tryConsume("register:" + clientIp, registerMaxAttempts, registerWindowSeconds);
    }

    private Result tryConsume(String key, int maxAttempts, int windowSeconds) {
        long now = System.currentTimeMillis();
        Window w = store.compute(key, (k, existing) -> {
            if (existing == null) {
                Window n = new Window();
                n.count = 1;
                return n;
            }
            long elapsedSec = (now - existing.windowStartMillis) / 1000;
            if (elapsedSec >= windowSeconds) {
                existing.count = 1;
                existing.windowStartMillis = now;
                return existing;
            }
            existing.count++;
            return existing;
        });

        long elapsedSec = (now - w.windowStartMillis) / 1000;
        int retryAfter = Math.max(0, windowSeconds - (int) elapsedSec);

        if (w.count > maxAttempts) {
            return new Result(false, retryAfter);
        }
        return new Result(true, 0);
    }
}
