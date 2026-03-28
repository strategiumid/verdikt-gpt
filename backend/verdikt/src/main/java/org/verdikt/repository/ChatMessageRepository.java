package org.verdikt.repository;

import org.verdikt.entity.Chat;
import org.verdikt.entity.ChatMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    List<ChatMessage> findByChatOrderByCreatedAtAsc(Chat chat);

    @EntityGraph(attributePaths = {"messageImages", "imageAnalyses"})
    Page<ChatMessage> findByChatOrderByCreatedAtAsc(Chat chat, Pageable pageable);

    Optional<ChatMessage> findFirstByChatAndRoleOrderByCreatedAtAsc(Chat chat, String role);

    /**
     * Последние N сообщений по ключу чата (chat.chatKey), отсортированные по убыванию createdAt.
     * Используется для восстановления недавнего контекста при стриминге через WebSocket.
     */
    List<ChatMessage> findTop10ByChat_ChatKeyOrderByIdDesc(String chatKey);

    /**
     * Последние N user-сообщений конкретного пользователя в конкретном чате (защита от утечек между юзерами).
     */
    List<ChatMessage> findTop10ByChat_User_IdAndChat_ChatKeyAndRoleOrderByIdDesc(Long userId, String chatKey, String role);
}

