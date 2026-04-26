package org.verdikt.repository;

import org.verdikt.entity.Chat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ChatRepository extends JpaRepository<Chat, Long> {

    Optional<Chat> findByUserIdAndChatKey(Long userId, String chatKey);
    Optional<Chat> findByUserIdAndChatKeyAndIsDeletedFalse(Long userId, String chatKey);

    List<Chat> findByUserIdAndIsDeletedFalseOrderByUpdatedAtDesc(Long userId);
    List<Chat> findByUserIdAndIsPrivateFalseAndIsDeletedFalseOrderByUpdatedAtDesc(Long userId);

    @Modifying
    @Query("update Chat c set c.isDeleted = true where c.user.id = :userId and c.chatKey = :chatKey and c.isDeleted = false")
    int softDeleteByUserIdAndChatKey(Long userId, String chatKey);
}

