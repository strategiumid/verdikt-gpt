package org.verdikt.dto;

import org.verdikt.entity.Chat;

import java.time.Instant;

public class AdminChatResponse {

    private Long id;
    private String chatKey;
    private String title;
    private Boolean isPrivate;
    private Boolean deleted;
    private Instant createdAt;
    private Instant updatedAt;

    public static AdminChatResponse from(Chat chat, String fallbackTitle) {
        AdminChatResponse response = new AdminChatResponse();
        response.setId(chat.getId());
        response.setChatKey(chat.getChatKey());
        response.setTitle(
                fallbackTitle != null && !fallbackTitle.isBlank()
                        ? fallbackTitle.trim()
                        : "Чат"
        );
        response.setIsPrivate(chat.isPrivate());
        response.setDeleted(chat.isDeleted());
        response.setCreatedAt(chat.getCreatedAt());
        response.setUpdatedAt(chat.getUpdatedAt());
        return response;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getChatKey() {
        return chatKey;
    }

    public void setChatKey(String chatKey) {
        this.chatKey = chatKey;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public Boolean getIsPrivate() {
        return isPrivate;
    }

    public void setIsPrivate(Boolean isPrivate) {
        this.isPrivate = isPrivate;
    }

    public Boolean getDeleted() {
        return deleted;
    }

    public void setDeleted(Boolean deleted) {
        this.deleted = deleted;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
