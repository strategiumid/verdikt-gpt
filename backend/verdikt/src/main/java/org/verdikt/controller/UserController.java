package org.verdikt.controller;

import org.verdikt.dto.SettingsResponse;
import org.verdikt.dto.UpdateProfileRequest;
import org.verdikt.dto.UpdateSettingsRequest;
import org.verdikt.dto.UserResponse;
import org.verdikt.entity.User;
import org.verdikt.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;

/**
 * Эндпоинты для текущего пользователя (профиль).
 */
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    /**
     * PATCH /api/users/me — обновление профиля текущего пользователя.
     * Требуется Authorization: Bearer &lt;token&gt;.
     */
    @PatchMapping("/me")
    public ResponseEntity<UserResponse> updateProfile(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody UpdateProfileRequest request
    ) {
        if (user == null) {
            return ResponseEntity.status(401).build();
        }
        UserResponse updated = userService.updateProfile(user.getId(), request);
        return ResponseEntity.ok(updated);
    }

    /**
     * GET /api/users/me/settings — настройки текущего пользователя (тема и др.).
     */
    @GetMapping("/me/settings")
    public ResponseEntity<SettingsResponse> getSettings(@AuthenticationPrincipal User user) {
        if (user == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(userService.getSettings(user.getId()));
    }

    /**
     * PATCH /api/users/me/settings — обновление настроек (тема и др.).
     */
    @PatchMapping("/me/settings")
    public ResponseEntity<SettingsResponse> updateSettings(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody UpdateSettingsRequest request
    ) {
        if (user == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(userService.updateSettings(user.getId(), request));
    }
}
