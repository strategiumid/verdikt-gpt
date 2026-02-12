package org.verdikt.controller;

import org.verdikt.dto.LoginRequest;
import org.verdikt.dto.LoginResponse;
import org.verdikt.dto.RegisterRequest;
import org.verdikt.dto.UserResponse;
import org.verdikt.entity.User;
import org.verdikt.repository.UserRepository;
import org.verdikt.service.JwtService;
import org.verdikt.service.UserService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

/**
 * Регистрация, логин, логаут и текущий пользователь.
 * JWT выдаётся в HttpOnly cookie (и опционально в теле для обратной совместимости — без токена в теле).
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;
    private final JwtService jwtService;
    private final UserRepository userRepository;

    @Value("${jwt.cookie-name:verdikt_token}")
    private String cookieName;

    @Value("${jwt.expiration-ms:86400000}")
    private long expirationMs;

    public AuthController(UserService userService, JwtService jwtService, UserRepository userRepository) {
        this.userService = userService;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
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
        UserResponse userResp = userService.register(request);
        User user = userRepository.findByEmail(userResp.getEmail()).orElseThrow();
        String token = jwtService.generateToken(user);
        String cookieHeader = buildCookie(token, httpRequest.isSecure());
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
        String cookieHeader = buildCookie(response.getToken(), httpRequest.isSecure());
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
}
