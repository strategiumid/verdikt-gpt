package org.verdikt.repository;

import org.verdikt.entity.Chat;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ChatRepository extends JpaRepository<Chat, Long> {

    Optional<Chat> findByUserIdAndChatKey(Long userId, String chatKey);

    List<Chat> findByUserIdOrderByUpdatedAtDesc(Long userId);
    List<Chat> findByUserIdAndIsPrivateFalseOrderByUpdatedAtDesc(Long userId);

    void deleteByUserIdAndChatKey(Long userId, String chatKey);
}

