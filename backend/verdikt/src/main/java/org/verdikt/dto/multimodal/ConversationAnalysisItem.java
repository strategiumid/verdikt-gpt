package org.verdikt.dto.multimodal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Анализ и планирование RAG для одной переписки (conversation_id).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ConversationAnalysisItem(
        @JsonProperty("conversation_id") String conversationId,
        @JsonProperty("intent_summary") String intentSummary,
        @JsonProperty("participant_user") ParticipantSideMetrics participantUser,
        @JsonProperty("participant_woman") ParticipantSideMetrics participantWoman,
        @JsonProperty("interaction_features") List<InteractionFeatureItem> interactionFeatures,
        @JsonProperty("conversation_dynamics") ConversationDynamics conversationDynamics,
        @JsonProperty("message_annotations") List<MessageAnnotation> messageAnnotations,
        @JsonProperty("conversation_hypotheses") List<ConversationHypothesis> conversationHypotheses,
        @JsonProperty("retrieval_queries") List<RetrievalQuery> retrievalQueries
) {}
