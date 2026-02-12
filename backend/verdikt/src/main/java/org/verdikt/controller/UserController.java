package org.verdikt.controller;

import org.verdikt.dto.UpdateProfileRequest;
import org.verdikt.dto.UserResponse;
import org.verdikt.entity.User;
import org.verdikt.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Эндпоинты для текущего пользователя (профиль).
 */
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    private final Path avatarUploadDir = Paths.get("uploads/avatars");

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
     * POST /api/users/me/avatar — загрузка аватарки текущего пользователя.
     */
    @PostMapping("/me/avatar")
    public ResponseEntity<UserResponse> uploadAvatar(
            @AuthenticationPrincipal User user,
            @RequestParam("file") MultipartFile file
    ) throws IOException {
        if (user == null) {
            return ResponseEntity.status(401).build();
        }
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        Files.createDirectories(avatarUploadDir);
        String filename = "user-" + user.getId() + "-" + System.currentTimeMillis() + "-" + file.getOriginalFilename();
        Path target = avatarUploadDir.resolve(filename);
        Files.copy(file.getInputStream(), target);

        String avatarUrl = "/uploads/avatars/" + filename;
        user.setAvatarUrl(avatarUrl);
        UserResponse updated = userService.updateProfile(user.getId(), toAvatarUpdateRequest(user));
        return ResponseEntity.ok(updated);
    }

    private UpdateProfileRequest toAvatarUpdateRequest(User user) {
        UpdateProfileRequest r = new UpdateProfileRequest();
        r.setAvatarUrl(user.getAvatarUrl());
        r.setName(user.getName());
        r.setEmail(user.getEmail());
        r.setBio(user.getBio());
        r.setPrivacy(user.getPrivacy());
        r.setExpertise(user.getExpertise());
        return r;
    }
}
