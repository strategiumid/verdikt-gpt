package org.verdikt.controller;

import org.verdikt.dto.LoginRequest;
import org.verdikt.dto.LoginResponse;
import org.verdikt.dto.RegisterRequest;
import org.verdikt.dto.UserResponse;
import org.verdikt.entity.User;
import org.verdikt.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import jakarta.validation.Valid;
import java.util.HashMap;
import java.util.Map;

/**
 * Регистрация, логин и текущий пользователь.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    /**
     * GET /api/auth/me — данные текущего пользователя по JWT.
     * Требуется Authorization: Bearer &lt;token&gt;.
     */
    @GetMapping("/me")
    public ResponseEntity<UserResponse> me(@AuthenticationPrincipal User user) {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(UserResponse.from(user));
    }

    /**
     * POST /api/auth/register
     * Тело: { "email": "user@example.com", "password": "secret123" }
     * Ответ: 201 + { "id", "email", "createdAt" } или 400/409 при ошибке.
     */
    @PostMapping("/register")
    public ResponseEntity<UserResponse> register(@Valid @RequestBody RegisterRequest request) {
        UserResponse user = userService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(user);
    }

    /**
     * POST /api/auth/login
     * Тело: { "email": "user@example.com", "password": "secret123" }
     * Ответ: 200 + { "token": "jwt...", "user": { "id", "email", "createdAt" } } или 401/400 при ошибке.
     */
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        try {
            LoginResponse response = userService.login(request);
            return ResponseEntity.ok(response);
        } catch (ResponseStatusException ex) {
            // Пробрасываем статус и человеко-понятное сообщение вместо HTTP 500
            Map<String, Object> body = new HashMap<>();
            body.put("message", ex.getReason());
            //noinspection unchecked
            return (ResponseEntity<LoginResponse>) ResponseEntity
                    .status(ex.getStatusCode())
                    .body(null);
        } catch (Exception ex) {
            // Любая неожиданная ошибка при логине — возвращаем 401 с общим текстом
            Map<String, Object> body = new HashMap<>();
            body.put("message", "Ошибка входа. Пожалуйста, проверьте данные и попробуйте ещё раз.");
            //noinspection unchecked
            return (ResponseEntity<LoginResponse>) ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(null);
        }
    }
}
