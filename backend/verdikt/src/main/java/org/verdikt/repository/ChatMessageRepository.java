package org.verdikt.repository;

import org.verdikt.entity.Chat;
import org.verdikt.entity.ChatMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    List<ChatMessage> findByChatOrderByCreatedAtAsc(Chat chat);

    Page<ChatMessage> findByChatOrderByCreatedAtAsc(Chat chat, Pageable pageable);

    /**
     * Последние N сообщений по ключу чата (chat.chatKey), отсортированные по убыванию createdAt.
     * Используется для восстановления недавнего контекста при стриминге через WebSocket.
     */
    List<ChatMessage> findTop10ByChat_ChatKeyOrderByIdDesc(String chatKey);
}

