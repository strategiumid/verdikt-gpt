package org.verdikt.dto.multimodal;

import java.util.List;

public record ExtractionQuality(
        String label,
        List<String> reasons
) {}
