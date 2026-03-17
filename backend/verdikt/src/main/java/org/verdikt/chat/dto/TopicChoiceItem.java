package org.verdikt.chat.dto;

public class TopicChoiceItem {

    private String topicId;
    private String title;

    public TopicChoiceItem() {
    }

    public TopicChoiceItem(String topicId, String title) {
        this.topicId = topicId;
        this.title = title;
    }

    public String getTopicId() {
        return topicId;
    }

    public void setTopicId(String topicId) {
        this.topicId = topicId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }
}
