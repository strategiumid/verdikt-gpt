package org.verdikt.controller;

import org.verdikt.dto.LoginRequest;
import org.verdikt.dto.LoginResponse;
import org.verdikt.dto.RegisterRequest;
import org.verdikt.dto.UserResponse;
import org.verdikt.service.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;

/**
 * Регистрация и логин.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
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
     * Ответ: 200 + { "token": "jwt...", "user": { "id", "email", "createdAt" } } или 401 при неверных данных.
     */
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        LoginResponse response = userService.login(request);
        return ResponseEntity.ok(response);
    }
}
