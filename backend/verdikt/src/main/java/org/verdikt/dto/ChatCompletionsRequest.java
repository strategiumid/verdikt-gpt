package org.verdikt.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonAnyGetter;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Chat completions payload: OpenAI-style fields for the upstream LLM plus Verdikt-internal fields
 * for RAG, multimodal persistence, and history (not sent upstream — see {@link #toUpstreamPayload()}).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChatCompletionsRequest {

    private String model;

    /** OpenAI chat messages; content may be string or structured (multimodal). Mutated in-place by {@code LlmProxyService}. */
    private List<Map<String, Object>> messages = new ArrayList<>();

    @JsonProperty("max_tokens")
    @JsonAlias("maxTokens")
    private Integer maxTokens;

    private Double temperature;
    private Boolean stream;

    private String chatId;
    private String originalUserMessage;
    private List<String> imageIds;
    private String imageAnalysis;
    private String ragQuery;
    private List<String> ragQueries;

    /** Extra parameters to forward to the LLM API (top_p, tools, etc.). */
    private Map<String, Object> passthrough = new HashMap<>();

    private static final java.util.Set<String> RESERVED =
            java.util.Set.of(
                    "model", "messages", "max_tokens", "maxTokens", "temperature", "stream",
                    "chatId", "originalUserMessage", "imageIds", "imageAnalysis", "ragQuery", "ragQueries");

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public List<Map<String, Object>> getMessages() {
        return messages;
    }

    public void setMessages(List<Map<String, Object>> messages) {
        this.messages = messages != null ? messages : new ArrayList<>();
    }

    public Integer getMaxTokens() {
        return maxTokens;
    }

    public void setMaxTokens(Integer maxTokens) {
        this.maxTokens = maxTokens;
    }

    public Double getTemperature() {
        return temperature;
    }

    public void setTemperature(Double temperature) {
        this.temperature = temperature;
    }

    public Boolean getStream() {
        return stream;
    }

    public void setStream(Boolean stream) {
        this.stream = stream;
    }

    public String getChatId() {
        return chatId;
    }

    public void setChatId(String chatId) {
        this.chatId = chatId;
    }

    public String getOriginalUserMessage() {
        return originalUserMessage;
    }

    public void setOriginalUserMessage(String originalUserMessage) {
        this.originalUserMessage = originalUserMessage;
    }

    public List<String> getImageIds() {
        return imageIds;
    }

    public void setImageIds(List<String> imageIds) {
        this.imageIds = imageIds;
    }

    public String getImageAnalysis() {
        return imageAnalysis;
    }

    public void setImageAnalysis(String imageAnalysis) {
        this.imageAnalysis = imageAnalysis;
    }

    public String getRagQuery() {
        return ragQuery;
    }

    public void setRagQuery(String ragQuery) {
        this.ragQuery = ragQuery;
    }

    public List<String> getRagQueries() {
        return ragQueries;
    }

    public void setRagQueries(List<String> ragQueries) {
        this.ragQueries = ragQueries;
    }

    @JsonAnySetter
    public void putPassthrough(String name, Object value) {
        if (name == null || RESERVED.contains(name)) {
            return;
        }
        passthrough.put(name, value);
    }

    @JsonAnyGetter
    public Map<String, Object> getPassthrough() {
        return passthrough;
    }

    /** Payload for POST /chat/completions — excludes Verdikt-internal fields. */
    @JsonIgnore
    public Map<String, Object> toUpstreamPayload() {
        Map<String, Object> m = new HashMap<>();
        if (model != null) {
            m.put("model", model);
        }
        if (temperature != null) {
            m.put("temperature", temperature);
        }
        if (maxTokens != null) {
            m.put("max_tokens", maxTokens);
        }
        if (stream != null) {
            m.put("stream", stream);
        }
        m.put("messages", messages != null ? messages : List.of());
        if (passthrough != null) {
            for (Map.Entry<String, Object> e : passthrough.entrySet()) {
                if (e.getKey() != null && e.getValue() != null) {
                    m.put(e.getKey(), e.getValue());
                }
            }
        }
        return m;
    }
}
