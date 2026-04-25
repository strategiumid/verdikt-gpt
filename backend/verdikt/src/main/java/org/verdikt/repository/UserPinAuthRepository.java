package org.verdikt.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.verdikt.entity.UserPinAuth;

import java.util.Optional;

public interface UserPinAuthRepository extends JpaRepository<UserPinAuth, Long> {
    Optional<UserPinAuth> findByDeviceId(String deviceId);
    Optional<UserPinAuth> findByUser_Id(Long userId);
}
