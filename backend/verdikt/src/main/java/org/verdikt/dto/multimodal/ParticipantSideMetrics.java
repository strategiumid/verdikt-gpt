package org.verdikt.dto.multimodal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record ParticipantSideMetrics(
        @JsonProperty("initiative_level") String initiativeLevel,
        @JsonProperty("effort_level") String effortLevel,
        @JsonProperty("reciprocity_level") String reciprocityLevel,
        @JsonProperty("questioning_level") String questioningLevel,
        @JsonProperty("topic_advancement_level") String topicAdvancementLevel
) {}
