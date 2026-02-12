package org.verdikt.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Тело запроса на создание вопроса.
 */
public class QuestionRequest {

    @NotBlank(message = "Текст вопроса обязателен")
    @Size(max = 4000, message = "Вопрос слишком длинный")
    private String content;

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }
}

