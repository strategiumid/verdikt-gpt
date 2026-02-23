package org.verdikt.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;

/**
 * Хранилище использованных nonce с TTL (защита от replay-атак).
 */
@Service
public class ReplayNonceStore {

    @Value("${app.replay.window-seconds:300}")
    private int windowSeconds;

    private final ConcurrentHashMap<String, Long> used = new ConcurrentHashMap<>();

    /**
     * Проверить и запомнить nonce. Возвращает true, если nonce ещё не использовался и успешно сохранён.
     */
    public boolean tryUse(String nonce) {
        if (nonce == null || nonce.isBlank()) return false;
        long expireAt = System.currentTimeMillis() + (windowSeconds + 60) * 1000L;
        Long prev = used.putIfAbsent(nonce, expireAt);
        if (prev != null) return false;
        cleanupExpired();
        return true;
    }

    private void cleanupExpired() {
        long now = System.currentTimeMillis();
        used.entrySet().removeIf(e -> e.getValue() < now);
    }
}
