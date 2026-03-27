package org.verdikt.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChatMessageDto {

    private Long id;
    private String role;
    private String content;
    /** ID RAG-элементов (qaId), использованных при генерации ответа. Только для assistant. */
    private java.util.List<Long> ragItemIds;
    /** ID изображений, прикрепленных к сообщению пользователя. */
    private java.util.List<String> imageIds;
    /** JSON анализа изображений, связанный с сообщением. */
    private String imageAnalysis;
    private java.time.Instant createdAt;

    public ChatMessageDto() {
    }

    public ChatMessageDto(String role, String content) {
        this.role = role;
        this.content = content;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public java.util.List<Long> getRagItemIds() {
        return ragItemIds;
    }

    public void setRagItemIds(java.util.List<Long> ragItemIds) {
        this.ragItemIds = ragItemIds;
    }

    public java.util.List<String> getImageIds() {
        return imageIds;
    }

    public void setImageIds(java.util.List<String> imageIds) {
        this.imageIds = imageIds;
    }

    public String getImageAnalysis() {
        return imageAnalysis;
    }

    public void setImageAnalysis(String imageAnalysis) {
        this.imageAnalysis = imageAnalysis;
    }

    public java.time.Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(java.time.Instant createdAt) {
        this.createdAt = createdAt;
    }
}

