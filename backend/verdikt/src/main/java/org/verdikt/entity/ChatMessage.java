package org.verdikt.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.BatchSize;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

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

    @BatchSize(size = 32)
    @OneToMany(mappedBy = "message", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<ChatMessageImage> messageImages = new ArrayList<>();

    @BatchSize(size = 32)
    @OneToMany(mappedBy = "message", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<ChatMessageImageAnalysis> imageAnalyses = new ArrayList<>();

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

    public List<ChatMessageImage> getMessageImages() {
        return messageImages;
    }

    public void setMessageImages(List<ChatMessageImage> messageImages) {
        this.messageImages = messageImages != null ? messageImages : new ArrayList<>();
    }

    public List<ChatMessageImageAnalysis> getImageAnalyses() {
        return imageAnalyses;
    }

    public void setImageAnalyses(List<ChatMessageImageAnalysis> imageAnalyses) {
        this.imageAnalyses = imageAnalyses != null ? imageAnalyses : new ArrayList<>();
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
