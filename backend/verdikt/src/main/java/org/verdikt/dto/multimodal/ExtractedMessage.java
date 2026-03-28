package org.verdikt.dto.multimodal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record ExtractedMessage(
        @JsonProperty("message_id") String messageId,
        @JsonProperty("global_order") Integer globalOrder,
        @JsonProperty("image_index") Integer imageIndex,
        @JsonProperty("order_in_image") Integer orderInImage,
        String sender,
        @JsonProperty("sender_confidence") Double senderConfidence,
        @JsonProperty("message_type") String messageType,
        @JsonProperty("bubble_side") String bubbleSide,
        @JsonProperty("has_emoji") Boolean hasEmoji,
        @JsonProperty("replies_to_visible_message_id") String repliesToVisibleMessageId,
        String text,
        @JsonProperty("text_confidence") Double textConfidence,
        @JsonProperty("timestamp_text") String timestampText,
        @JsonProperty("is_partial") Boolean isPartial,
        @JsonProperty("has_unreadable_fragment") Boolean hasUnreadableFragment
) {}
