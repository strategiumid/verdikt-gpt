package org.verdikt.dto.multimodal;

import java.util.List;

public record ConversationHypothesis(
        String label,
        Double confidence,
        List<String> evidence
) {}
