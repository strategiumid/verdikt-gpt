package org.verdikt.service;

import org.verdikt.chat.dto.ChooseTopicResponse;
import org.verdikt.chat.model.ConversationState;

import java.util.Map;

/**
 * Result of ChatOrchestratorService.processTurn.
 */
public sealed interface OrchestratorResult permits OrchestratorResult.ChooseTopic, OrchestratorResult.Stream {

    record ChooseTopic(ChooseTopicResponse response) implements OrchestratorResult {}

    /**
     * Body for LlmProxyService.chatCompletionsStream. After streaming, call ChatOrchestratorService.finishTurn.
     * effectiveQuery is the query used for RAG (body.ragQuery); stored separately because LlmProxyService removes it.
     */
    record Stream(Map<String, Object> body,
                 ConversationState state,
                 String rawUserMessage,
                 String effectiveQuery,
                 boolean skipUserMessage) implements OrchestratorResult {}
}
