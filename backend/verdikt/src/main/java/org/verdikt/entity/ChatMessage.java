package org.verdikt.entity;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "chat_messages")
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "chat_id", nullable = false)
    private Chat chat;

    @Column(name = "role", nullable = false, length = 32)
    private String role;

    @Lob
    @Column(name = "content", nullable = false)
    private String content;

    /** JSON-массив ID RAG-элементов (qaId), использованных при генерации ответа. Только для role=assistant. */
    @Column(name = "rag_item_ids", length = 500)
    private String ragItemIdsJson;

    /** JSON-массив ID вложенных изображений (для user-сообщений). */
    @Column(name = "image_ids", length = 2000)
    private String imageIdsJson;

    /** JSON с анализом изображений, использованным в multimodal-пайплайне. */
    @Lob
    @Column(name = "image_analysis")
    private String imageAnalysisJson;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Chat getChat() {
        return chat;
    }

    public void setChat(Chat chat) {
        this.chat = chat;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getRagItemIdsJson() {
        return ragItemIdsJson;
    }

    public void setRagItemIdsJson(String ragItemIdsJson) {
        this.ragItemIdsJson = ragItemIdsJson;
    }

    public String getImageIdsJson() {
        return imageIdsJson;
    }

    public void setImageIdsJson(String imageIdsJson) {
        this.imageIdsJson = imageIdsJson;
    }

    public String getImageAnalysisJson() {
        return imageAnalysisJson;
    }

    public void setImageAnalysisJson(String imageAnalysisJson) {
        this.imageAnalysisJson = imageAnalysisJson;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}

