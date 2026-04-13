package org.verdikt.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.verdikt.repository.EmailVerificationRequestRepository;

import java.time.LocalDateTime;

@Component
public class EmailVerificationCleanupJob {

    private final EmailVerificationRequestRepository repository;

    public EmailVerificationCleanupJob(EmailVerificationRequestRepository repository) {
        this.repository = repository;
    }

    @Scheduled(cron = "${app.email.verification.cleanup-cron:0 */30 * * * *}")
    @Transactional
    public void cleanup() {
        repository.deleteGarbage(LocalDateTime.now().minusDays(1));
    }
}
