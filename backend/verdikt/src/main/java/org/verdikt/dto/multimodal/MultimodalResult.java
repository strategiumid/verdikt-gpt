package org.verdikt.dto.multimodal;

import java.util.List;

public record MultimodalResult(
        List<RetrievalQuery> queries,
        VisionExtractionResult extraction,
        QueryPlanningResult planning
) {}
