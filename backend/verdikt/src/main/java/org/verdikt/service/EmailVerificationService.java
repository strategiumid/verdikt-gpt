package org.verdikt.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.verdikt.entity.EmailVerificationRequest;
import org.verdikt.entity.User;
import org.verdikt.repository.EmailVerificationRequestRepository;
import org.verdikt.repository.UserRepository;
import org.verdikt.service.email.EmailSender;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class EmailVerificationService {

    private static final String PURPOSE_SIGNUP = "signup";
    private static final String PURPOSE_RESET_PASSWORD = "reset_password";

    private final EmailVerificationRequestRepository repository;
    private final UserRepository userRepository;
    private final EmailSender emailSender;
    private final PasswordEncoder passwordEncoder;
    private final RateLimitService rateLimitService;

    @Value("${app.email.verification.ttl-minutes:5}")
    private long ttlMinutes;

    @Value("${app.email.verification.max-attempts:5}")
    private int maxAttempts;

    @Value("${app.email.verification.resend-cooldown-seconds:60}")
    private long resendCooldownSeconds;

    @Value("${app.email.verification.max-resends-per-hour:5}")
    private int maxResendsPerHour;

    @Value("${app.email.verification.ip.max-per-hour:20}")
    private int maxPerIpPerHour;

    @Value("${app.email.verification.ip-email.max-per-hour:10}")
    private int maxPerIpEmailPerHour;

    public EmailVerificationService(EmailVerificationRequestRepository repository,
                                    UserRepository userRepository,
                                    EmailSender emailSender,
                                    PasswordEncoder passwordEncoder,
                                    RateLimitService rateLimitService) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.emailSender = emailSender;
        this.passwordEncoder = passwordEncoder;
        this.rateLimitService = rateLimitService;
    }

    public String signupPurpose() {
        return PURPOSE_SIGNUP;
    }

    public String resetPasswordPurpose() {
        return PURPOSE_RESET_PASSWORD;
    }

    @Transactional
    public void sendCode(String rawEmail, String purpose, String clientIp) {
        String email = normalizeEmail(rawEmail);
        String p = normalizePurpose(purpose);
        if (email == null || p == null) {
            return;
        }

        // Neutral behavior: for unknown email we still return successful controller response without sending.
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return;
        }
        User existingUser = userOpt.get();
        if (PURPOSE_SIGNUP.equals(p) && existingUser.isEmailVerified()) {
            return;
        }
        if (PURPOSE_RESET_PASSWORD.equals(p) && !existingUser.isEmailVerified()) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        enforceIpLimits(clientIp, email);

        repository.findLatestActive(email, p).ifPresent(existing -> {
            if (existing.getLastSentAt().plusSeconds(resendCooldownSeconds).isAfter(now)) {
                throw new TooManyRequestsException("COOLDOWN");
            }
        });

        long sentLastHour = repository.countByEmailAndPurposeAndCreatedAtAfter(email, p, now.minusHours(1));
        if (sentLastHour >= maxResendsPerHour) {
            throw new TooManyRequestsException("HOURLY_LIMIT");
        }

        repository.findLatestActive(email, p).ifPresent(existing -> {
            existing.setUsed(true);
            repository.save(existing);
        });

        String code = generateCode();
        EmailVerificationRequest entity = new EmailVerificationRequest();
        entity.setEmail(email);
        entity.setPurpose(p);
        entity.setCodeHash(passwordEncoder.encode(code));
        entity.setExpiresAt(now.plusMinutes(ttlMinutes));
        entity.setUsed(false);
        entity.setAttempts(0);
        entity.setResendCount(1);
        entity.setLastSentAt(now);
        entity.setCreatedAt(now);
        repository.save(entity);

        String idempotencyKey = "email-verification:" + p + ":" + email + ":" + UUID.randomUUID();
        emailSender.sendVerificationCode(email, code, idempotencyKey);
    }

    @Transactional
    public boolean verifyCode(String rawEmail, String purpose, String inputCode) {
        String email = normalizeEmail(rawEmail);
        String p = normalizePurpose(purpose);
        if (email == null || p == null || inputCode == null || !inputCode.matches("^\\d{6}$")) {
            return false;
        }
        LocalDateTime now = LocalDateTime.now();

        Optional<EmailVerificationRequest> opt = repository.findLatestActive(email, p);
        if (opt.isEmpty()) {
            return false;
        }
        EmailVerificationRequest entity = opt.get();

        if (entity.isUsed()) {
            return false;
        }
        if (entity.getExpiresAt().isBefore(now)) {
            entity.setUsed(true);
            repository.save(entity);
            return false;
        }
        if (entity.getAttempts() >= maxAttempts) {
            entity.setUsed(true);
            repository.save(entity);
            return false;
        }

        boolean matches = passwordEncoder.matches(inputCode, entity.getCodeHash());
        if (!matches) {
            entity.setAttempts(entity.getAttempts() + 1);
            if (entity.getAttempts() >= maxAttempts) {
                entity.setUsed(true);
            }
            repository.save(entity);
            return false;
        }

        entity.setUsed(true);
        entity.setVerifiedAt(now);
        repository.save(entity);

        userRepository.findByEmail(email).ifPresent(user -> {
            user.setEmailVerified(true);
            userRepository.save(user);
        });
        return true;
    }

    private void enforceIpLimits(String clientIp, String email) {
        String ip = (clientIp == null || clientIp.isBlank()) ? "unknown" : clientIp.trim();
        RateLimitService.Result byIp = rateLimitService.tryCustom("email_send:ip:" + ip, maxPerIpPerHour, 3600);
        if (!byIp.allowed()) {
            throw new TooManyRequestsException("IP_LIMIT");
        }
        RateLimitService.Result byIpEmail = rateLimitService.tryCustom("email_send:ip_email:" + ip + ":" + email, maxPerIpEmailPerHour, 3600);
        if (!byIpEmail.allowed()) {
            throw new TooManyRequestsException("IP_EMAIL_LIMIT");
        }
    }

    private String normalizeEmail(String email) {
        if (email == null) return null;
        String out = email.trim().toLowerCase();
        return out.isBlank() ? null : out;
    }

    private String normalizePurpose(String purpose) {
        if (purpose == null) return null;
        String out = purpose.trim().toLowerCase();
        return out.isBlank() ? null : out;
    }

    private String generateCode() {
        return String.format("%06d", ThreadLocalRandom.current().nextInt(0, 1_000_000));
    }

    public static class TooManyRequestsException extends RuntimeException {
        public TooManyRequestsException(String message) {
            super(message);
        }
    }
}
