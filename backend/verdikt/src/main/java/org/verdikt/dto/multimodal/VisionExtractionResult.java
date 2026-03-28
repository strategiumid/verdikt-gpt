package org.verdikt.dto.multimodal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public record VisionExtractionResult(
        @JsonProperty("schema_version") String schemaVersion,
        @JsonProperty("user_text") String userText,
        List<ExtractedMessage> messages,
        @JsonProperty("visible_facts") List<String> visibleFacts,
        @JsonProperty("missing_context") List<String> missingContext,
        @JsonProperty("extraction_quality") ExtractionQuality extractionQuality
) {}
