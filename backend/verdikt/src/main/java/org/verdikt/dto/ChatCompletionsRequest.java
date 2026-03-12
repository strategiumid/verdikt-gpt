package org.verdikt.dto;

import com.fasterxml.jackson.annotation.JsonAnyGetter;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChatCompletionsRequest {

    private String model;
    private List<ChatMessageDto> messages = new ArrayList<>();
    private Integer max_tokens;
    private Double temperature;
    private Boolean stream;

    // Дополнительные параметры, которые мы не моделируем явно, но хотим сохранить при проксировании
    private Map<String, Object> other = new HashMap<>();

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public List<ChatMessageDto> getMessages() {
        return messages;
    }

    public void setMessages(List<ChatMessageDto> messages) {
        this.messages = messages;
    }

    public Integer getMax_tokens() {
        return max_tokens;
    }

    public void setMax_tokens(Integer max_tokens) {
        this.max_tokens = max_tokens;
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

    @JsonAnySetter
    public void setOther(String name, Object value) {
        this.other.put(name, value);
    }

    @JsonAnyGetter
    public Map<String, Object> getOther() {
        return other;
    }
}

