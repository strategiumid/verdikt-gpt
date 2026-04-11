package org.verdikt.entity;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * Оценка ответа ИИ (в т.ч. мобильное приложение).
 * <p>Обычно клиент передаёт: {@code chatId}, {@code messageId} (id сообщения ассистента в чате, строка),
 * {@link #rating}, опционально {@link #comment}. Пользователь и время создания задаются на сервере.
 * Рейтинг: {@code 1} — полезно, {@code -1} — не полезно.
 */
@Entity
@Table(name = "ai_feedback")
public class AiFeedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "chat_id", length = 64)
    private String chatId;

    /** Id сообщения ассистента (как в API/WebSocket), строка до 64 символов. */
    @Column(name = "message_id", length = 64)
    private String messageId;

    /** 1 = полезно, -1 = не полезно */
    @Column(name = "rating", nullable = false)
    private int rating;

    @Column(name = "user_prompt", length = 4000)
    private String userPrompt;

    @Column(name = "ai_content", length = 10000)
    private String aiContent;

    @Column(name = "topic", length = 50)
    private String topic;

    /** Произвольный комментарий пользователя к оценке (мобильный клиент). Колонка {@code feedback_comment} — не ключевое слово SQL. */
    @Column(name = "feedback_comment", length = 2000)
    private String comment;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public String getChatId() {
        return chatId;
    }

    public void setChatId(String chatId) {
        this.chatId = chatId;
    }

    public String getMessageId() {
        return messageId;
    }

    public void setMessageId(String messageId) {
        this.messageId = messageId;
    }

    public int getRating() {
        return rating;
    }

    public void setRating(int rating) {
        this.rating = rating;
    }

    public String getUserPrompt() {
        return userPrompt;
    }

    public void setUserPrompt(String userPrompt) {
        this.userPrompt = userPrompt;
    }

    public String getAiContent() {
        return aiContent;
    }

    public void setAiContent(String aiContent) {
        this.aiContent = aiContent;
    }

    public String getTopic() {
        return topic;
    }

    public void setTopic(String topic) {
        this.topic = topic;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
