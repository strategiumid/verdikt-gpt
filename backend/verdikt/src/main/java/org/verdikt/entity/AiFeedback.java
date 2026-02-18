package org.verdikt.entity;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * Оценка ответа ИИ: полезно (1) или не полезно (-1).
 * Привязана к пользователю.
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

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
