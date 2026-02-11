package org.verdikt.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Пользователь приложения.
 * Пока только модель (таблица в БД). Регистрация и логин - отдельным шагом.
 */
@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Email обязателен")
    @Email(message = "Некорректный email")
    @Size(max = 255)
    @Column(nullable = false, unique = true, length = 255)
    private String email;

    /** Хэш пароля (никогда не храним пароль в открытом виде) */
    @NotBlank
    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Size(max = 255)
    @Column(name = "name", length = 255)
    private String name;

    @Size(max = 2000)
    @Column(name = "bio", length = 2000)
    private String bio;

    @Size(max = 50)
    @Column(name = "privacy", length = 50)
    private String privacy;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "user_expertise", joinColumns = @JoinColumn(name = "user_id"))
    @Column(name = "expertise", length = 100)
    private List<String> expertise = new ArrayList<>();

    // --- Геттеры и сеттеры ---

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

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
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