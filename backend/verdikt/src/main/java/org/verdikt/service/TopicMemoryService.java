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
        // factsFromUser только из MemoryUpdateService (устойчивые факты), не сырой текст каждого сообщения.
        topic.setLastRagRetrievalQueries(rewrite != null && !rewrite.isBlank() ? rewrite : "");
        topic.setUserGoal("understand and get advice");
        topic.setLastRewrite(rewrite);
        topic.setAssistantReferenceSummary("Discussed the user's initial question.");
        topic.setLastQaIds(qaIds);
        return topic;
    }

    public void updateTopic(TopicMemory topic,
                            String userMessage,
                            String rewrite,
                            String lastRagRetrievalQueries,
                            String assistantSummary,
                            List<Long> qaIds,
                            int turnNumber) {
        topic.setLastUsedTurn(turnNumber);
        topic.setLastRewrite(rewrite);
        topic.setLastRagRetrievalQueries(lastRagRetrievalQueries != null ? lastRagRetrievalQueries : "");
        topic.setAssistantReferenceSummary(assistantSummary);
        topic.setLastQaIds(qaIds);

        TopicMemoryFactsHelper.dedupePreserveOrder(topic.getFactsFromUser());
    }

    private String buildDisplayTitle(String userMessage) {
        if (userMessage == null || userMessage.isBlank()) {
            return "Current topic";
        }
        String trimmed = userMessage.trim();
        return trimmed.length() <= 60 ? trimmed : trimmed.substring(0, 60) + "...";
    }
}
