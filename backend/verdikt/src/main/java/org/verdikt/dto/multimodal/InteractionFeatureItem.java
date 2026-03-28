package org.verdikt.dto.multimodal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record InteractionFeatureItem(
        String label,
        @JsonProperty("applies_to") String appliesTo,
        Double confidence,
        @JsonProperty("evidence_message_ids") List<String> evidenceMessageIds
) {}
