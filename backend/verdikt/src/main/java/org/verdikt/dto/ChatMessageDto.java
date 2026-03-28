package org.verdikt.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChatMessageDto {

    private Long id;
    private String role;
    private String content;
    /** ID RAG-элементов (qaId), использованных при генерации ответа. Только для assistant. */
    private List<Long> ragItemIds;
    /** ID изображений, прикреплённых к сообщению (порядок как при отправке). */
    private List<String> imageIds;
    /** Одна или несколько записей анализа (мультимодальный пайплайн), каждая со своим набором imageIds. */
    private List<MessageImageAnalysisDto> imageAnalyses;
    private Instant createdAt;

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

    public List<Long> getRagItemIds() {
        return ragItemIds;
    }

    public void setRagItemIds(List<Long> ragItemIds) {
        this.ragItemIds = ragItemIds;
    }

    public List<String> getImageIds() {
        return imageIds;
    }

    public void setImageIds(List<String> imageIds) {
        this.imageIds = imageIds;
    }

    public List<MessageImageAnalysisDto> getImageAnalyses() {
        return imageAnalyses;
    }

    public void setImageAnalyses(List<MessageImageAnalysisDto> imageAnalyses) {
        this.imageAnalyses = imageAnalyses;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
