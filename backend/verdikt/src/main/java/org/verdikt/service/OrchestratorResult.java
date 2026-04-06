package org.verdikt.service;

import org.verdikt.chat.dto.ChooseTopicResponse;
import org.verdikt.chat.model.ConversationState;
import org.verdikt.dto.ChatCompletionsRequest;

/**
 * Result of ChatOrchestratorService.processTurn.
 */
public sealed interface OrchestratorResult permits OrchestratorResult.ChooseTopic, OrchestratorResult.Stream {

    record ChooseTopic(ChooseTopicResponse response) implements OrchestratorResult {}

    /**
     * Request for LlmProxyService.chatCompletionsStream. After streaming, call ChatOrchestratorService.finishTurn.
     * effectiveQuery is the rewrite/query used for topic memory; request may still carry ragQuery after RAG enrich.
     */
    record Stream(ChatCompletionsRequest request,
                 ConversationState state,
                 String rawUserMessage,
                 String effectiveQuery,
                 boolean skipUserMessage) implements OrchestratorResult {}
}
