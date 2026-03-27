package org.verdikt.dto.multimodal;

import java.util.List;

public record ToneHypothesis(
        String label,
        Double confidence,
        List<String> evidence
) {}
