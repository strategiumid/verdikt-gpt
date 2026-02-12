package org.verdikt.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Тело запроса PATCH /api/users/me — обновление профиля.
 */
public class UpdateProfileRequest {

    @Size(max = 255)
    private String name;

    @Email(message = "Некорректный email")
    @Size(max = 255)
    private String email;

    @Size(max = 2000)
    private String bio;

    @Size(max = 50)
    private String privacy;

    private List<@Size(max = 100) String> expertise;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getBio() {
        return bio;
    }

    public void setBio(String bio) {
        this.bio = bio;
    }

    public String getPrivacy() {
        return privacy;
    }

    public void setPrivacy(String privacy) {
        this.privacy = privacy;
    }

    public List<String> getExpertise() {
        return expertise;
    }

    public void setExpertise(List<String> expertise) {
        this.expertise = expertise;
    }
}
