package org.verdikt.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.verdikt.entity.EmailVerificationRequest;

import java.time.LocalDateTime;
import java.util.Optional;

public interface EmailVerificationRequestRepository extends JpaRepository<EmailVerificationRequest, Long> {

    @Query("""
        select e from EmailVerificationRequest e
        where e.email = :email
          and e.purpose = :purpose
          and e.used = false
        order by e.createdAt desc
        """)
    Optional<EmailVerificationRequest> findLatestActive(@Param("email") String email, @Param("purpose") String purpose);

    long countByEmailAndPurposeAndCreatedAtAfter(String email, String purpose, LocalDateTime after);

    @Modifying
    @Query("""
        delete from EmailVerificationRequest e
        where e.used = true
           or e.expiresAt < :threshold
        """)
    int deleteGarbage(@Param("threshold") LocalDateTime threshold);
}
