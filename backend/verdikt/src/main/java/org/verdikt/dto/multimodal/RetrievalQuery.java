package org.verdikt.dto.multimodal;

public record RetrievalQuery(
        String type,
        String text,
        Double confidence
) {}
