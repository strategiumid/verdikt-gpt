package org.verdikt.dto.multimodal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record QueryPlanningResult(
        @JsonProperty("schema_version") String schemaVersion,
        @JsonProperty("intent_summary") String intentSummary,
        @JsonProperty("message_annotations") List<MessageAnnotation> messageAnnotations,
        @JsonProperty("conversation_hypotheses") List<ConversationHypothesis> conversationHypotheses,
        @JsonProperty("retrieval_queries") List<RetrievalQuery> retrievalQueries
) {}
