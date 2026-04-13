package org.verdikt.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.verdikt.service.EmailVerificationService;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;

@RestController
@RequestMapping("/api/auth/email-verification")
public class EmailVerificationController {

    private final EmailVerificationService service;

    public EmailVerificationController(EmailVerificationService service) {
        this.service = service;
    }

    @PostMapping("/send")
    public ResponseEntity<Map<String, Object>> send(@Valid @RequestBody SendRequest request, HttpServletRequest httpRequest) {
        String generic = "Если адрес допустим, код будет отправлен.";
        try {
            service.sendCode(request.getEmail(), service.signupPurpose(), getClientIp(httpRequest));
            return ResponseEntity.ok(Map.of("sent", true, "message", generic));
        } catch (EmailVerificationService.TooManyRequestsException ex) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of("sent", false, "message", "Слишком много запросов. Пожалуйста, попробуйте позже."));
        } catch (Exception ignored) {
            // Neutral response to avoid account enumeration.
            return ResponseEntity.ok(Map.of("sent", true, "message", generic));
        }
    }

    @PostMapping("/verify")
    public ResponseEntity<Map<String, Object>> verify(@Valid @RequestBody VerifyRequest request) {
        boolean ok = service.verifyCode(request.getEmail(), service.signupPurpose(), request.getCode());
        if (!ok) {
            return ResponseEntity.badRequest().body(Map.of(
                    "verified", false,
                    "message", "Неверный или просроченный код"
            ));
        }
        return ResponseEntity.ok(Map.of("verified", true));
    }

    private String getClientIp(HttpServletRequest request) {
        if (request == null) return "unknown";
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "unknown";
    }

    public static class SendRequest {
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

    public static class VerifyRequest {
        @Email
        @NotBlank
        private String email;

        @NotBlank
        @Pattern(regexp = "^\\d{6}$")
        private String code;

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
    }
}
