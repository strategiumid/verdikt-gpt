package org.verdikt.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.verdikt.entity.UserPushToken;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface UserPushTokenRepository extends JpaRepository<UserPushToken, Long> {
    Optional<UserPushToken> findByFcmToken(String fcmToken);
    Optional<UserPushToken> findByUser_IdAndDeviceId(Long userId, String deviceId);
    List<UserPushToken> findByUser_IdAndIsActiveTrue(Long userId);
    List<UserPushToken> findByUser_IdInAndIsActiveTrue(Collection<Long> userIds);
    List<UserPushToken> findByIsActiveTrue();
}
