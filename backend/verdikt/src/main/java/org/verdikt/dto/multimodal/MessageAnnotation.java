package org.verdikt.dto.multimodal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record MessageAnnotation(
        @JsonProperty("message_id") String messageId,
        @JsonProperty("tone_hypothesis") ToneHypothesis toneHypothesis,
        @JsonProperty("interaction_role") String interactionRole,
        @JsonProperty("effort_signal") String effortSignal,
        /** Встречное движение / ответность реплики относительно контекста: high | medium | low | unclear */
        @JsonProperty("reciprocity_signal") String reciprocitySignal
) {}
