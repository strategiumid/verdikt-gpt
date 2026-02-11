package org.verdikt.dto;

import org.verdikt.entity.User;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Ответ с данными пользователя (без пароля).
 */
public class UserResponse {

    private Long id;
    private String email;
    private String name;
    private String bio;
    private String privacy;
    private List<String> expertise = new ArrayList<>();
    private Instant createdAt;

    public static UserResponse from(User user) {
        UserResponse r = new UserResponse();
        r.setId(user.getId());
        r.setEmail(user.getEmail());
        r.setName(user.getName());
        r.setBio(user.getBio());
        r.setPrivacy(user.getPrivacy());
        r.setExpertise(user.getExpertise() != null ? new ArrayList<>(user.getExpertise()) : new ArrayList<>());
        r.setCreatedAt(user.getCreatedAt());
        return r;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
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
        this.expertise = expertise != null ? expertise : new ArrayList<>();
    }
}
