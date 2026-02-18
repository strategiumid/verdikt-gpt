package org.verdikt.dto;

import org.verdikt.entity.AiFeedback;

import java.time.Instant;

/**
 * Ответ: одна запись оценки ответа ИИ (для списка и аналитики).
 */
public class FeedbackResponse {

    private Long id;
    private int rating;
    private String topic;
    private Instant createdAt;
    private String messageId;
    private String chatId;
    /** Имя оценщика (для админ-аналитики по всем пользователям) */
    private String userName;

    public static FeedbackResponse from(AiFeedback f) {
        FeedbackResponse r = new FeedbackResponse();
        r.setId(f.getId());
        r.setRating(f.getRating());
        r.setTopic(f.getTopic());
        r.setCreatedAt(f.getCreatedAt());
        r.setMessageId(f.getMessageId());
        r.setChatId(f.getChatId());
        return r;
    }

    public static FeedbackResponse fromWithUser(AiFeedback f) {
        FeedbackResponse r = from(f);
        if (f.getUser() != null) {
            r.setUserName(f.getUser().getName() != null && !f.getUser().getName().isBlank()
                    ? f.getUser().getName()
                    : f.getUser().getEmail());
        }
        return r;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public int getRating() {
        return rating;
    }

    public void setRating(int rating) {
        this.rating = rating;
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

    public String getMessageId() {
        return messageId;
    }

    public void setMessageId(String messageId) {
        this.messageId = messageId;
    }

    public String getChatId() {
        return chatId;
    }

    public void setChatId(String chatId) {
        this.chatId = chatId;
    }

    public String getUserName() {
        return userName;
    }

    public void setUserName(String userName) {
        this.userName = userName;
    }
}
