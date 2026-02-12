package org.verdikt.dto;

/**
 * Ответ GET /api/users/me/settings — настройки пользователя (тема и др.).
 */
public class SettingsResponse {

    private String theme;

    public String getTheme() {
        return theme;
    }

    public void setTheme(String theme) {
        this.theme = theme;
    }
}
