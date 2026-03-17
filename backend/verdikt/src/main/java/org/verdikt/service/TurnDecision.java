package org.verdikt.service;

import org.verdikt.chat.model.TopicMemory;

import java.util.List;

public class TurnDecision {

    public enum Type {
        FIRST_MESSAGE,
        USE_TOPIC,
        ASK_USER_TO_CHOOSE
    }

    private final Type type;
    private final TopicMemory topic;
    private final List<TopicMemory> topics;

    private TurnDecision(Type type, TopicMemory topic, List<TopicMemory> topics) {
        this.type = type;
        this.topic = topic;
        this.topics = topics;
    }

    public static TurnDecision firstMessage() {
        return new TurnDecision(Type.FIRST_MESSAGE, null, null);
    }

    public static TurnDecision useTopic(TopicMemory topic) {
        return new TurnDecision(Type.USE_TOPIC, topic, null);
    }

    public static TurnDecision askUserToChoose(List<TopicMemory> topics) {
        return new TurnDecision(Type.ASK_USER_TO_CHOOSE, null, topics);
    }

    public Type getType() {
        return type;
    }

    public TopicMemory getTopic() {
        return topic;
    }

    public List<TopicMemory> getTopics() {
        return topics;
    }
}
