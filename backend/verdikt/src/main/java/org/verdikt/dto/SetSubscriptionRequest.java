package org.verdikt.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Тело запроса PATCH /api/admin/users/{id}/subscription (free, lite, pro, ultimate).
 * PATCH /api/users/me/subscription принимает только free (платные тарифы — через админку, см. UserService.updateSubscription).
 */
public class SetSubscriptionRequest {

    @NotBlank(message = "Укажите подписку")
    @Pattern(regexp = "^(free|lite|pro|ultimate)$", message = "Подписка: free, lite, pro или ultimate")
    @Size(max = 20)
    private String subscription;

    public String getSubscription() {
        return subscription;
    }

    public void setSubscription(String subscription) {
        this.subscription = subscription;
    }
}
