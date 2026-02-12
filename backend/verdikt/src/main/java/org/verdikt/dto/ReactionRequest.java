package org.verdikt.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * Тело запроса POST /api/questions/{id}/reaction — лайк или дизлайк.
 */
public class ReactionRequest {

    @NotBlank(message = "Укажите тип: like или dislike")
    @Pattern(regexp = "^(like|dislike)$", message = "Тип должен быть like или dislike")
    private String type;

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }
}
