package org.verdikt.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * Persisted multimodal analysis linked to a subset of images on the same message.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MessageImageAnalysisDto {

    private Long id;
    /** Attachment UUIDs this analysis was computed for (same order as stored). */
    private List<String> imageIds;
    /** JSON payload (e.g. extraction + planning) for this analysis run. */
    private String payloadJson;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public List<String> getImageIds() {
        return imageIds;
    }

    public void setImageIds(List<String> imageIds) {
        this.imageIds = imageIds;
    }

    public String getPayloadJson() {
        return payloadJson;
    }

    public void setPayloadJson(String payloadJson) {
        this.payloadJson = payloadJson;
    }
}
