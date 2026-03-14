package org.verdikt.dto;

import java.util.List;

/**
 * Результат вызова LLM: тело ответа и список ID RAG-элементов (qaId), использованных в контексте.
 */
public class LlmCompletionResult {

    private final String responseBody;
    private final List<Long> ragItemIds;

    public LlmCompletionResult(String responseBody, List<Long> ragItemIds) {
        this.responseBody = responseBody;
        this.ragItemIds = ragItemIds != null ? List.copyOf(ragItemIds) : List.of();
    }

    public String getResponseBody() {
        return responseBody;
    }

    public List<Long> getRagItemIds() {
        return ragItemIds;
    }
}
