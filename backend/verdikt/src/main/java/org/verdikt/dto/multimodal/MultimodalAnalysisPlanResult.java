package org.verdikt.dto.multimodal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Результат текстового этапа: отдельный анализ по каждой переписке.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record MultimodalAnalysisPlanResult(
        @JsonProperty("schema_version") String schemaVersion,
        @JsonProperty("conversation_analyses") List<ConversationAnalysisItem> conversationAnalyses
) {}
