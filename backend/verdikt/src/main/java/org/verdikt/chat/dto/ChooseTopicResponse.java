package org.verdikt.chat.dto;

import java.util.ArrayList;
import java.util.List;

public class ChooseTopicResponse {

    private String type = "choose_topic";
    private String chatId;
    private Long messageId;
    private List<TopicChoiceItem> topics = new ArrayList<>();

    public String getType() {
        return type;
    }

    public String getChatId() {
        return chatId;
    }

    public void setChatId(String chatId) {
        this.chatId = chatId;
    }

    public Long getMessageId() {
        return messageId;
    }

    public void setMessageId(Long messageId) {
        this.messageId = messageId;
    }

    public List<TopicChoiceItem> getTopics() {
        return topics;
    }

    public void setTopics(List<TopicChoiceItem> topics) {
        this.topics = topics;
    }
}
