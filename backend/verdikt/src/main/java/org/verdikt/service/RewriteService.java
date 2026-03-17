package org.verdikt.service;

import org.springframework.stereotype.Service;
import org.verdikt.chat.model.TopicMemory;

import java.util.stream.Collectors;

@Service
public class RewriteService {

    private final LlmProxyService llmProxyService;

    public RewriteService(LlmProxyService llmProxyService) {
        this.llmProxyService = llmProxyService;
    }

    /**
     * First message: no rewrite, return original.
     * Later turns: call LLM to rewrite into standalone search query.
     */
    public String rewrite(TopicMemory topic, String currentMessage) {
        if (topic == null) {
            return currentMessage != null ? currentMessage : "";
        }
        String input = buildRewriteInput(topic, currentMessage);
        String result = llmProxyService.completeSimple(input);
        return result != null && !result.isBlank() ? result.trim() : (currentMessage != null ? currentMessage : "");
    }

    public String buildRewriteInput(TopicMemory topic, String currentMessage) {
        String facts = topic.getFactsFromUser() == null
                ? ""
                : topic.getFactsFromUser().stream().collect(Collectors.joining("; "));

        return """
                Context topic: %s
                User goal: %s
                Previous search query: %s
                Facts from user: %s
                Current user message: %s

                Rewrite the current user message into one standalone search query.
                Keep original meaning.
                Do not answer.
                """.formatted(
                safe(topic.getTopicLabel()),
                safe(topic.getUserGoal()),
                safe(topic.getLastRewrite()),
                facts,
                safe(currentMessage)
        );
    }

    private String safe(String s) {
        return s == null ? "" : s;
    }
}
