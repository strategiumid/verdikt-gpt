package org.verdikt.controller;

import org.verdikt.dto.LoginRequest;
import org.verdikt.dto.LoginResponse;
import org.verdikt.dto.PinLoginRequest;
import org.verdikt.dto.PinRegisterRequest;
import org.verdikt.dto.RegisterRequest;
import org.verdikt.dto.UserResponse;
import org.verdikt.entity.User;
import org.verdikt.service.PinAuthService;
import org.verdikt.service.UserService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import jakarta.validation.Valid;
import java.util.Map;

/**
 * Регистрация, логин, логаут и текущий пользователь.
 * JWT выдаётся в HttpOnly cookie (и опционально в теле для обратной совместимости — без токена в теле).
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;
    private final PinAuthService pinAuthService;

    @Value("${jwt.cookie-name:verdikt_token}")
    private String cookieName;

    @Value("${jwt.expiration-ms:86400000}")
    private long expirationMs;

    public AuthController(UserService userService, PinAuthService pinAuthService) {
        this.userService = userService;
        this.pinAuthService = pinAuthService;
    }

    /**
     * GET /api/auth/me — данные текущего пользователя по JWT (cookie или Authorization).
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
     * Тело: { "name?", "email", "password" }
     * Ответ: 201 + Set-Cookie (JWT) + body UserResponse.
     */
    @PostMapping("/register")
    public ResponseEntity<UserResponse> register(
            @Valid @RequestBody RegisterRequest request,
            HttpServletRequest httpRequest
    ) {
        LoginResponse response = userService.registerForAuth(request, getClientIp(httpRequest));
        UserResponse userResp = response.getUser();
        String token = response.getToken();
        String cookieHeader = buildCookie(token, httpRequest.isSecure());
        token = null;
        return ResponseEntity.status(HttpStatus.CREATED)
                .header("Set-Cookie", cookieHeader)
                .body(userResp);
    }

    /**
     * POST /api/auth/login
     * Тело: { "email", "password" }
     * Ответ: 200 + Set-Cookie (JWT) + body { "user" } (токен не в теле — защита от XSS).
     */
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest
    ) {
        LoginResponse response = userService.login(request);
        String token = response.getToken();
        String cookieHeader = buildCookie(token, httpRequest.isSecure());
        token = null;
        return ResponseEntity.ok()
                .header("Set-Cookie", cookieHeader)
                .body(new LoginResponse(null, response.getUser()));
    }

    /**
     * POST /api/auth/logout — сброс cookie (выход).
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest httpRequest) {
        String clearCookie = buildClearCookie(httpRequest.isSecure());
        return ResponseEntity.ok().header("Set-Cookie", clearCookie).build();
    }

    @PostMapping("/password-reset/send")
    public ResponseEntity<Map<String, Object>> sendPasswordReset(
            @Valid @RequestBody PasswordResetSendRequest request,
            HttpServletRequest httpRequest
    ) {
        String generic = "Если адрес допустим, код будет отправлен.";
        try {
            userService.sendPasswordResetCode(request.getEmail(), getClientIp(httpRequest));
            return ResponseEntity.ok(Map.of("sent", true, "message", generic));
        } catch (Exception ignored) {
            return ResponseEntity.ok(Map.of("sent", true, "message", generic));
        }
    }

    @PostMapping("/password-reset/confirm")
    public ResponseEntity<Map<String, Object>> confirmPasswordReset(
            @Valid @RequestBody PasswordResetConfirmRequest request
    ) {
        boolean ok = userService.resetPasswordWithCode(request.getEmail(), request.getCode(), request.getNewPassword());
        if (!ok) {
            return ResponseEntity.badRequest().body(Map.of(
                    "reset", false,
                    "message", "Неверный или просроченный код"
            ));
        }
        return ResponseEntity.ok(Map.of("reset", true));
    }

    @PostMapping("/pin/register")
    public ResponseEntity<Map<String, Object>> registerPin(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody PinRegisterRequest request
    ) {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        pinAuthService.registerPin(user.getId(), request.getDeviceId(), request.getPinCode());
        return ResponseEntity.ok(Map.of("registered", true));
    }

    @PostMapping("/pin/login")
    public ResponseEntity<LoginResponse> loginWithPin(
            @Valid @RequestBody PinLoginRequest request,
            HttpServletRequest httpRequest
    ) {
        LoginResponse response = pinAuthService.loginWithPin(request.getDeviceId(), request.getPinCode());
        String token = response.getToken();
        String cookieHeader = buildCookie(token, httpRequest.isSecure());
        return ResponseEntity.ok()
                .header("Set-Cookie", cookieHeader)
                .body(response);
    }

    private String buildCookie(String token, boolean secure) {
        int maxAgeSec = (int) (expirationMs / 1000);
        StringBuilder sb = new StringBuilder();
        sb.append(cookieName).append("=").append(token)
                .append("; Path=/; Max-Age=").append(maxAgeSec)
                .append("; HttpOnly; SameSite=Lax");
        if (secure) {
            sb.append("; Secure");
        }
        return sb.toString();
    }

    private String buildClearCookie(boolean secure) {
        StringBuilder sb = new StringBuilder();
        sb.append(cookieName).append("=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
        if (secure) {
            sb.append("; Secure");
        }
        return sb.toString();
    }

    private String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "unknown";
    }

    public static class PasswordResetSendRequest {
        @Email
        @NotBlank
        private String email;

        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }
    }

    public static class PasswordResetConfirmRequest {
        @Email
        @NotBlank
        private String email;

        @NotBlank
        @Pattern(regexp = "^\\d{6}$")
        private String code;

        @NotBlank
        @Size(min = 6, max = 100)
        private String newPassword;

        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }

        public String getCode() {
            return code;
        }

        public void setCode(String code) {
            this.code = code;
        }

        public String getNewPassword() {
            return newPassword;
        }

        public void setNewPassword(String newPassword) {
            this.newPassword = newPassword;
        }
    }
}
