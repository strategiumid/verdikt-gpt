package org.verdikt.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Тело запроса POST /api/users/me/feedback — оценка ответа ИИ.
 */
public class FeedbackRequest {

    /** 1 = полезно, -1 = не полезно */
    @NotNull(message = "Укажите оценку: 1 или -1")
    @Min(value = -1, message = "Оценка должна быть 1 или -1")
    @Max(value = 1, message = "Оценка должна быть 1 или -1")
    private Integer rating;

    @Size(max = 64)
    private String messageId;

    @Size(max = 64)
    private String chatId;

    @Size(max = 4000)
    private String userPrompt;

    @Size(max = 10000)
    private String aiContent;

    @Size(max = 50)
    private String topic;

    public Integer getRating() {
        return rating;
    }

    public void setRating(Integer rating) {
        this.rating = rating;
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
}
