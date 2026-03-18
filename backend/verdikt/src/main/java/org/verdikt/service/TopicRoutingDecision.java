package org.verdikt.service;

import org.verdikt.chat.model.TopicMemory;

/**
 * Result of topic routing. No LLM call — routing is rule-based.
 */
public class TopicRoutingDecision {

    public enum Type {
        /** First message in chat — no topics yet */
        FIRST_MESSAGE,
        /** Use the specified topic */
        USE_TOPIC,
        /** Multiple topics, ambiguous — ask user to choose */
        ASK_USER
    }

    private final Type type;
    private final String topicId;

    private TopicRoutingDecision(Type type, String topicId) {
        this.type = type;
        this.topicId = topicId;
    }

    public static TopicRoutingDecision firstMessage() {
        return new TopicRoutingDecision(Type.FIRST_MESSAGE, null);
    }

    public static TopicRoutingDecision useTopic(String topicId) {
        return new TopicRoutingDecision(Type.USE_TOPIC, topicId);
    }

    public static TopicRoutingDecision askUser() {
        return new TopicRoutingDecision(Type.ASK_USER, null);
    }

    public Type getType() {
        return type;
    }

    public String getTopicId() {
        return topicId;
    }
}
