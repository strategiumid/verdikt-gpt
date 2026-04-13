package org.verdikt.service.email;

public interface EmailSender {
    void sendVerificationCode(String toEmail, String code, String idempotencyKey);
}
