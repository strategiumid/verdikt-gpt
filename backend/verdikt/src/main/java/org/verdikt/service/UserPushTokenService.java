package org.verdikt.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.verdikt.entity.User;
import org.verdikt.entity.UserPushToken;
import org.verdikt.repository.UserPushTokenRepository;
import org.verdikt.repository.UserRepository;

import java.time.Instant;
import java.util.List;

@Service
public class UserPushTokenService {

    private final UserPushTokenRepository tokenRepository;
    private final UserRepository userRepository;

    public UserPushTokenService(UserPushTokenRepository tokenRepository, UserRepository userRepository) {
        this.tokenRepository = tokenRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public void upsertToken(Long userId, String rawToken, String rawPlatform, String rawDeviceId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Пользователь не найден"));
        String token = normalizeToken(rawToken);
        String platform = normalizePlatform(rawPlatform);
        String deviceId = normalizeDeviceId(rawDeviceId);
        if (token == null || platform == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Некорректный FCM token/platform");
        }

        tokenRepository.findByFcmToken(token).ifPresent(existing -> {
            existing.setUser(user);
            existing.setPlatform(platform);
            existing.setDeviceId(deviceId);
            existing.setActive(true);
            existing.setUpdatedAt(Instant.now());
            tokenRepository.save(existing);
        });
        if (tokenRepository.findByFcmToken(token).isPresent()) {
            return;
        }

        UserPushToken row = deviceId == null
                ? new UserPushToken()
                : tokenRepository.findByUser_IdAndDeviceId(userId, deviceId).orElse(new UserPushToken());
        row.setUser(user);
        row.setFcmToken(token);
        row.setPlatform(platform);
        row.setDeviceId(deviceId);
        row.setActive(true);
        if (row.getCreatedAt() == null) {
            row.setCreatedAt(Instant.now());
        }
        row.setUpdatedAt(Instant.now());
        tokenRepository.save(row);
    }

    @Transactional
    public void deactivateToken(Long userId, String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }
        tokenRepository.findByFcmToken(rawToken.trim()).ifPresent(row -> {
            if (row.getUser() != null && row.getUser().getId() != null && row.getUser().getId().equals(userId)) {
                row.setActive(false);
                row.setUpdatedAt(Instant.now());
                tokenRepository.save(row);
            }
        });
    }

    @Transactional(readOnly = true)
    public List<UserPushToken> getActiveTokensForUser(Long userId) {
        return tokenRepository.findByUser_IdAndIsActiveTrue(userId);
    }

    @Transactional(readOnly = true)
    public List<UserPushToken> getActiveTokensForUsers(List<Long> userIds) {
        return tokenRepository.findByUser_IdInAndIsActiveTrue(userIds);
    }

    @Transactional(readOnly = true)
    public List<UserPushToken> getAllActiveTokens() {
        return tokenRepository.findByIsActiveTrue();
    }

    private String normalizeToken(String token) {
        if (token == null) return null;
        String out = token.trim();
        return out.isBlank() ? null : out;
    }

    private String normalizePlatform(String platform) {
        if (platform == null) return null;
        String out = platform.trim().toLowerCase();
        return out.isBlank() ? null : out;
    }

    private String normalizeDeviceId(String deviceId) {
        if (deviceId == null) return null;
        String out = deviceId.trim();
        return out.isBlank() ? null : out;
    }
}
