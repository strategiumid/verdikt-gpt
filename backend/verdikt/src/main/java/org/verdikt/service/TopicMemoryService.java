package org.verdikt.service;

import org.springframework.stereotype.Service;
import org.verdikt.chat.model.TopicMemory;

import java.util.List;
import java.util.UUID;

@Service
public class TopicMemoryService {

    public TopicMemory createInitialTopic(String userMessage,
                                          String rewrite,
                                          List<Long> qaIds) {
        TopicMemory topic = new TopicMemory();
        topic.setTopicId("topic_" + UUID.randomUUID());
        topic.setTopicLabel("general");
        topic.setDisplayTitle(buildDisplayTitle(userMessage));
        topic.setLastUsedTurn(1);
        topic.getFactsFromUser().add(userMessage);
        topic.setUserGoal("understand and get advice");
        topic.setLastRewrite(rewrite);
        topic.setAssistantReferenceSummary("Discussed the user's initial question.");
        topic.setLastQaIds(qaIds);
        return topic;
    }

    public void updateTopic(TopicMemory topic,
                            String userMessage,
                            String rewrite,
                            String assistantSummary,
                            List<Long> qaIds,
                            int turnNumber) {
        topic.setLastUsedTurn(turnNumber);
        topic.setLastRewrite(rewrite);
        topic.setAssistantReferenceSummary(assistantSummary);
        topic.setLastQaIds(qaIds);

        if (topic.getFactsFromUser().size() < 10) {
            topic.getFactsFromUser().add(userMessage);
        }
    }

    private String buildDisplayTitle(String userMessage) {
        if (userMessage == null || userMessage.isBlank()) {
            return "Current topic";
        }
        String trimmed = userMessage.trim();
        return trimmed.length() <= 60 ? trimmed : trimmed.substring(0, 60) + "...";
    }
}
