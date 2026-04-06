package org.verdikt.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Режим модели для стрима чата (WebSocket {@code modelType}).
 */
public enum VerdiktModelType {
    VERDIKT_CHAT("verdikt-chat"),
    VERDIKT_REASONER("verdikt-reasoner"),
    VERDIKT_AUTO("verdikt-auto");

    private final String jsonValue;

    VerdiktModelType(String jsonValue) {
        this.jsonValue = jsonValue;
    }

    @JsonValue
    public String getJsonValue() {
        return jsonValue;
    }

    @JsonCreator
    public static VerdiktModelType fromJson(String v) {
        if (v == null || v.isBlank()) {
            return VERDIKT_CHAT;
        }
        String t = v.trim();
        for (VerdiktModelType e : values()) {
            if (e.jsonValue.equalsIgnoreCase(t)) {
                return e;
            }
        }
        return VERDIKT_CHAT;
    }

    public boolean usesLlmRagQueryRewriter() {
        return this == VERDIKT_AUTO || this == VERDIKT_REASONER;
    }
}
