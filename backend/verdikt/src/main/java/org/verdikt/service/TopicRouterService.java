package org.verdikt.service;

import org.springframework.stereotype.Service;
import org.verdikt.chat.model.ConversationState;
import org.verdikt.chat.model.TopicMemory;

import java.util.List;

/**
 * Routes user message to a topic. No LLM call — rule-based only.
 * - selectedTopicId provided: use it
 * - only one topic: use it
 * - multiple topics, no selection: ask user to choose
 */
@Service
public class TopicRouterService {

    public TopicRoutingDecision route(String message, String selectedTopicId, ConversationState state) {
        if (state == null || state.getTopics() == null || state.getTopics().isEmpty()) {
            return TopicRoutingDecision.firstMessage();
        }

        List<TopicMemory> topics = state.getTopics();

        if (selectedTopicId != null && !selectedTopicId.isBlank()) {
            boolean topicExists = topics.stream()
                    .anyMatch(t -> selectedTopicId.equals(t.getTopicId()));
            if (topicExists) {
                return TopicRoutingDecision.useTopic(selectedTopicId);
            }
        }

        if (topics.size() == 1) {
            return TopicRoutingDecision.useTopic(topics.get(0).getTopicId());
        }

        if (topics.size() > 1) {
            String matched = tryMatchTopic(message, topics);
            if (matched != null) {
                return TopicRoutingDecision.useTopic(matched);
            }
            return TopicRoutingDecision.askUser();
        }

        return TopicRoutingDecision.firstMessage();
    }

    /**
     * Simple heuristic: if message contains significant words from a topic's displayTitle or topicLabel,
     * consider it a match. Otherwise null.
     */
    private String tryMatchTopic(String message, List<TopicMemory> topics) {
        if (message == null || message.isBlank()) return null;
        String lower = message.toLowerCase();

        for (TopicMemory t : topics) {
            String title = t.getDisplayTitle();
            String label = t.getTopicLabel();
            if (title != null && !title.isBlank()) {
                String[] words = title.toLowerCase().split("\\s+");
                int matches = 0;
                for (String w : words) {
                    if (w.length() >= 3 && lower.contains(w)) matches++;
                }
                if (matches >= 2) return t.getTopicId();
            }
            if (label != null && !label.isBlank()) {
                String[] words = label.toLowerCase().split("\\s+");
                int matches = 0;
                for (String w : words) {
                    if (w.length() >= 3 && lower.contains(w)) matches++;
                }
                if (matches >= 2) return t.getTopicId();
            }
        }
        return null;
    }
}
