package org.verdikt.service.email;

public interface EmailSender {
    /**
     * @param purpose например {@code signup} или {@code reset_password} — текст письма зависит от назначения.
     */
    void sendVerificationCode(String toEmail, String code, String idempotencyKey, String purpose);
}
