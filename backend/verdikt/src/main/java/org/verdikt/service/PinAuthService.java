package org.verdikt.service;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.verdikt.dto.LoginResponse;
import org.verdikt.dto.UserResponse;
import org.verdikt.entity.User;
import org.verdikt.entity.UserPinAuth;
import org.verdikt.repository.UserPinAuthRepository;
import org.verdikt.repository.UserRepository;

import java.time.Instant;

@Service
public class PinAuthService {

    private final UserPinAuthRepository userPinAuthRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public PinAuthService(UserPinAuthRepository userPinAuthRepository,
                          UserRepository userRepository,
                          PasswordEncoder passwordEncoder,
                          JwtService jwtService) {
        this.userPinAuthRepository = userPinAuthRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public void registerPin(Long userId, String rawDeviceId, String rawPinCode) {
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Войдите в аккаунт");
        }
        String deviceId = normalizeDeviceId(rawDeviceId);
        String pinCode = normalizePin(rawPinCode);
        if (deviceId == null || pinCode == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Некорректные данные PIN-авторизации");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Пользователь не найден"));
        if (user.isBanned()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Аккаунт заблокирован");
        }
        if (!user.isEmailVerified()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Подтвердите email");
        }

        userPinAuthRepository.findByDeviceId(deviceId).ifPresent(existing -> userPinAuthRepository.delete(existing));
        userPinAuthRepository.deleteByUser_Id(userId);

        UserPinAuth pinAuth = new UserPinAuth();
        pinAuth.setUser(user);
        pinAuth.setDeviceId(deviceId);
        pinAuth.setPinHash(passwordEncoder.encode(pinCode));
        pinAuth.setCreatedAt(Instant.now());
        pinAuth.setUpdatedAt(Instant.now());
        userPinAuthRepository.save(pinAuth);
    }

    @Transactional(readOnly = true)
    public LoginResponse loginWithPin(String rawDeviceId, String rawPinCode) {
        String deviceId = normalizeDeviceId(rawDeviceId);
        String pinCode = normalizePin(rawPinCode);
        if (deviceId == null || pinCode == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Неверный deviceId или pinCode");
        }

        UserPinAuth pinAuth = userPinAuthRepository.findByDeviceId(deviceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Неверный deviceId или pinCode"));
        User user = pinAuth.getUser();
        if (user == null || user.isBanned() || !user.isEmailVerified()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Доступ запрещён");
        }
        if (!passwordEncoder.matches(pinCode, pinAuth.getPinHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Неверный deviceId или pinCode");
        }

        String token = jwtService.generateToken(user);
        return new LoginResponse(token, UserResponse.from(user));
    }

    private String normalizeDeviceId(String deviceId) {
        if (deviceId == null) return null;
        String out = deviceId.trim();
        return out.isBlank() ? null : out;
    }

    private String normalizePin(String pin) {
        if (pin == null) return null;
        String out = pin.trim();
        if (!out.matches("^\\d{4,10}$")) {
            return null;
        }
        return out;
    }
}
