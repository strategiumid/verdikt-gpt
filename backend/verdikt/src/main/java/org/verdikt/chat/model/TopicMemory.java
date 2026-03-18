package org.verdikt.chat.model;

import java.util.ArrayList;
import java.util.List;

public class TopicMemory {

    private String topicId;
    private String topicLabel;
    private String displayTitle;
    private int lastUsedTurn;
    private List<String> factsFromUser = new ArrayList<>();
    private String userGoal;
    private String lastRewrite;
    private String assistantReferenceSummary;
    private List<Long> lastQaIds = new ArrayList<>();

    public String getTopicId() {
        return topicId;
    }

    public void setTopicId(String topicId) {
        this.topicId = topicId;
    }

    public String getTopicLabel() {
        return topicLabel;
    }

    public void setTopicLabel(String topicLabel) {
        this.topicLabel = topicLabel;
    }

    public String getDisplayTitle() {
        return displayTitle;
    }

    public void setDisplayTitle(String displayTitle) {
        this.displayTitle = displayTitle;
    }

    public int getLastUsedTurn() {
        return lastUsedTurn;
    }

    public void setLastUsedTurn(int lastUsedTurn) {
        this.lastUsedTurn = lastUsedTurn;
    }

    public List<String> getFactsFromUser() {
        return factsFromUser;
    }

    public void setFactsFromUser(List<String> factsFromUser) {
        this.factsFromUser = factsFromUser;
    }

    public String getUserGoal() {
        return userGoal;
    }

    public void setUserGoal(String userGoal) {
        this.userGoal = userGoal;
    }

    public String getLastRewrite() {
        return lastRewrite;
    }

    public void setLastRewrite(String lastRewrite) {
        this.lastRewrite = lastRewrite;
    }

    public String getAssistantReferenceSummary() {
        return assistantReferenceSummary;
    }

    public void setAssistantReferenceSummary(String assistantReferenceSummary) {
        this.assistantReferenceSummary = assistantReferenceSummary;
    }

    public List<Long> getLastQaIds() {
        return lastQaIds;
    }

    public void setLastQaIds(List<Long> lastQaIds) {
        this.lastQaIds = lastQaIds;
    }
}
