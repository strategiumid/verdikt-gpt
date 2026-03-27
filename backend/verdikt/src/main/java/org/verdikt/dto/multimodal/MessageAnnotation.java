package org.verdikt.dto.multimodal;

import com.fasterxml.jackson.annotation.JsonProperty;

public record MessageAnnotation(
        @JsonProperty("message_id") String messageId,
        @JsonProperty("tone_hypothesis") ToneHypothesis toneHypothesis
) {}
