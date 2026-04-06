package org.verdikt.dto.multimodal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Сводка динамики диалога. Значения полей — из фиксированных наборов (см. промпт этапа interaction):
 * <ul>
 *   <li>{@code initiative_balance}: user_dominant | balanced | woman_dominant | unclear</li>
 *   <li>{@code engagement_balance}: user_heavier | balanced | woman_heavier | unclear</li>
 *   <li>{@code warmth_balance}: user_warmer | balanced | woman_warmer | unclear</li>
 *   <li>{@code responsiveness_pattern}: engaged | mixed | dry | unclear</li>
 *   <li>{@code trajectory}: warming | stable | cooling | mixed | unclear</li>
 * </ul>
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ConversationDynamics(
        @JsonProperty("initiative_balance") String initiativeBalance,
        @JsonProperty("engagement_balance") String engagementBalance,
        @JsonProperty("warmth_balance") String warmthBalance,
        @JsonProperty("responsiveness_pattern") String responsivenessPattern,
        String trajectory
) {}
