package org.verdikt.chat.model;

import java.util.ArrayList;
import java.util.List;

public class ConversationState {

    private String activeTopicId;
    private int turnCounter;
    private List<TopicMemory> topics = new ArrayList<>();

    public String getActiveTopicId() {
        return activeTopicId;
    }

    public void setActiveTopicId(String activeTopicId) {
        this.activeTopicId = activeTopicId;
    }

    public int getTurnCounter() {
        return turnCounter;
    }

    public void setTurnCounter(int turnCounter) {
        this.turnCounter = turnCounter;
    }

    public List<TopicMemory> getTopics() {
        return topics;
    }

    public void setTopics(List<TopicMemory> topics) {
        this.topics = topics;
    }
}
