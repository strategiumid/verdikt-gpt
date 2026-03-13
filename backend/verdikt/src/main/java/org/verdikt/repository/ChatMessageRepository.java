package org.verdikt.repository;

import org.verdikt.entity.Chat;
import org.verdikt.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    List<ChatMessage> findByChatOrderByCreatedAtAsc(Chat chat);
}

