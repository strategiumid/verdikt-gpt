package org.verdikt.dto.multimodal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record InteractionAnalysisResult(
        @JsonProperty("schema_version") String schemaVersion,
        @JsonProperty("participant_user") ParticipantSideMetrics participantUser,
        @JsonProperty("participant_woman") ParticipantSideMetrics participantWoman,
        @JsonProperty("interaction_features") List<InteractionFeatureItem> interactionFeatures,
        @JsonProperty("conversation_dynamics") ConversationDynamics conversationDynamics
) {}
