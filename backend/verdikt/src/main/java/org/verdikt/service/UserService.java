package org.verdikt.service;

import org.verdikt.dto.LoginRequest;
import org.verdikt.dto.LoginResponse;
import org.verdikt.dto.RegisterRequest;
import org.verdikt.dto.SetSubscriptionRequest;
import org.verdikt.dto.SettingsResponse;
import org.verdikt.dto.UpdateProfileRequest;
import org.verdikt.dto.UpdateSettingsRequest;
import org.verdikt.dto.UsageResponse;
import org.verdikt.dto.UserResponse;
import org.verdikt.entity.User;
import org.verdikt.repository.UserRepository;

import java.time.YearMonth;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    /**
     * Регистрация нового пользователя.
     * Проверяет, что email ещё не занят, хэширует пароль (BCrypt), сохраняет в БД.
     */
    @Transactional
    public UserResponse register(RegisterRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        if (userRepository.findByEmail(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Пользователь с таким email уже зарегистрирован");
        }
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        if (request.getName() != null && !request.getName().isBlank()) {
            user.setName(request.getName().trim());
        }
        if (userRepository.count() == 0) {
            user.setRole("ADMIN");
        }
        user = userRepository.save(user);
        return UserResponse.from(user);
    }

    /**
     * Логин: проверка email и пароля, выдача JWT.
     * При неверных данных — 401 Unauthorized.
     */
    public LoginResponse login(LoginRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Неверный email или пароль"));
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Неверный email или пароль");
        }
        if (user.isBanned()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Аккаунт заблокирован");
        }
        String token = jwtService.generateToken(user);
        return new LoginResponse(token, UserResponse.from(user));
    }

    /**
     * Обновление профиля пользователя по id (частичное обновление: только переданные поля).
     */
    @Transactional
    public UserResponse updateProfile(Long userId, UpdateProfileRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Пользователь не найден"));
        if (request.getName() != null) {
            user.setName(request.getName().trim());
        }
        if (request.getEmail() != null) {
            String email = request.getEmail().trim().toLowerCase();
            userRepository.findByEmail(email)
                    .filter(u -> !u.getId().equals(userId))
                    .ifPresent(u -> {
                        throw new ResponseStatusException(HttpStatus.CONFLICT, "Email уже занят");
                    });
            user.setEmail(email);
        }
        if (request.getBio() != null) {
            user.setBio(request.getBio().trim());
        }
        if (request.getPrivacy() != null) {
            user.setPrivacy(request.getPrivacy().trim());
        }
        if (request.getExpertise() != null) {
            user.setExpertise(request.getExpertise());
        }
        user = userRepository.save(user);
        return UserResponse.from(user);
    }

    /**
     * Получить настройки пользователя (тема и др.).
     */
    public SettingsResponse getSettings(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Пользователь не найден"));
        SettingsResponse r = new SettingsResponse();
        r.setTheme(user.getTheme());
        return r;
    }

    /**
     * Обновить настройки пользователя (частично).
     */
    @Transactional
    public SettingsResponse updateSettings(Long userId, UpdateSettingsRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Пользователь не найден"));
        if (request.getTheme() != null) {
            user.setTheme(request.getTheme().trim());
        }
        user = userRepository.save(user);
        SettingsResponse r = new SettingsResponse();
        r.setTheme(user.getTheme());
        return r;
    }

    /**
     * Смена плана подписки пользователя (для себя — /api/users/me/subscription).
     */
    @Transactional
    public UserResponse updateSubscription(Long userId, SetSubscriptionRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Пользователь не найден"));
        user.setSubscription(request.getSubscription());
        user = userRepository.save(user);
        return UserResponse.from(user);
    }

    private static final int LIMIT_FREE = 5;
    private static final int LIMIT_LITE = 20;
    private static final int LIMIT_PRO = 100;
    private static final int LIMIT_ULTIMATE = 300;

    private int getUsageLimit(String subscription) {
        if (subscription == null) return LIMIT_FREE;
        switch (subscription.trim().toLowerCase()) {
            case "lite": return LIMIT_LITE;
            case "pro": return LIMIT_PRO;
            case "ultimate": return LIMIT_ULTIMATE;
            default: return LIMIT_FREE;
        }
    }

    private void ensureUsagePeriod(User user) {
        String current = YearMonth.now().toString();
        if (current.equals(user.getUsagePeriodStart())) return;
        user.setUsagePeriodStart(current);
        user.setAiRequestsUsed(0);
    }

    @Transactional
    public UsageResponse getUsage(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Пользователь не найден"));
        ensureUsagePeriod(user);
        userRepository.save(user);
        UsageResponse r = new UsageResponse();
        r.setUsed(user.getAiRequestsUsed());
        r.setLimit(getUsageLimit(user.getSubscription()));
        r.setPeriodStart(user.getUsagePeriodStart());
        return r;
    }

    @Transactional
    public UsageResponse incrementAiRequests(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Пользователь не найден"));
        ensureUsagePeriod(user);
        int limit = getUsageLimit(user.getSubscription());
        if (user.getAiRequestsUsed() >= limit) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Исчерпан лимит запросов на этот месяц. Обновите план подписки.");
        }
        user.setAiRequestsUsed(user.getAiRequestsUsed() + 1);
        user = userRepository.save(user);
        UsageResponse r = new UsageResponse();
        r.setUsed(user.getAiRequestsUsed());
        r.setLimit(limit);
        r.setPeriodStart(user.getUsagePeriodStart());
        return r;
    }
}
