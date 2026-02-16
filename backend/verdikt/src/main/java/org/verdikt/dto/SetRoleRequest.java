package org.verdikt.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Тело запроса PATCH /api/admin/users/{id}/role.
 */
public class SetRoleRequest {

    @NotBlank(message = "Укажите роль")
    @Pattern(regexp = "^(USER|ADMIN)$", message = "Роль должна быть USER или ADMIN")
    @Size(max = 20)
    private String role;

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }
}
