package org.verdikt.entity;

import jakarta.persistence.*;

import java.util.ArrayList;
import java.util.List;

/**
 * One multimodal analysis run for a user message, covering one or more attached images.
 * {@link #analyzedImageIds} lists which attachment IDs were included in this analysis.
 */
@Entity
@Table(name = "chat_message_image_analyses")
public class ChatMessageImageAnalysis {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "message_id", nullable = false)
    private ChatMessage message;

    @Lob
    @Column(name = "payload_json", nullable = false)
    private String payloadJson;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(
            name = "chat_message_image_analysis_image_ids",
            joinColumns = @JoinColumn(name = "analysis_id", nullable = false))
    @Column(name = "image_id", nullable = false, length = 36)
    @OrderColumn(name = "sort_ord")
    private List<String> analyzedImageIds = new ArrayList<>();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public ChatMessage getMessage() {
        return message;
    }

    public void setMessage(ChatMessage message) {
        this.message = message;
    }

    public String getPayloadJson() {
        return payloadJson;
    }

    public void setPayloadJson(String payloadJson) {
        this.payloadJson = payloadJson;
    }

    public List<String> getAnalyzedImageIds() {
        return analyzedImageIds;
    }

    public void setAnalyzedImageIds(List<String> analyzedImageIds) {
        this.analyzedImageIds = analyzedImageIds != null ? new ArrayList<>(analyzedImageIds) : new ArrayList<>();
    }
}
