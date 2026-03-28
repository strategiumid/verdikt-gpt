package org.verdikt.dto.multimodal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record ExtractedConversation(
        @JsonProperty("conversation_id") String conversationId,
        @JsonProperty("image_index") Integer imageIndex,
        @JsonProperty("chat_title") String chatTitle,
        @JsonProperty("other_participant_label") String otherParticipantLabel
) {}
