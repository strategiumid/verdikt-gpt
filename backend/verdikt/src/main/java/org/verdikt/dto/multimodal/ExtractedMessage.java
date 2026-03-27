package org.verdikt.dto.multimodal;

import com.fasterxml.jackson.annotation.JsonProperty;

public record ExtractedMessage(
        @JsonProperty("message_id") String messageId,
        @JsonProperty("image_index") Integer imageIndex,
        @JsonProperty("order_in_image") Integer orderInImage,
        String sender,
        @JsonProperty("sender_confidence") Double senderConfidence,
        String text,
        @JsonProperty("text_confidence") Double textConfidence,
        @JsonProperty("timestamp_text") String timestampText,
        @JsonProperty("is_partial") Boolean isPartial,
        @JsonProperty("has_unreadable_fragment") Boolean hasUnreadableFragment
) {}
