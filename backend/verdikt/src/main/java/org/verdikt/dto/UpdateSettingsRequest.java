package org.verdikt.dto;

import jakarta.validation.constraints.Size;

/**
 * Тело запроса PATCH /api/users/me/settings — обновление настроек (тема и др.).
 */
public class UpdateSettingsRequest {

    @Size(max = 50)
    private String theme;

    public String getTheme() {
        return theme;
    }

    public void setTheme(String theme) {
        this.theme = theme;
    }
}
