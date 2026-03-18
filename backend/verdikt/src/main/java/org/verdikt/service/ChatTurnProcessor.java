package org.verdikt.service;

import org.springframework.stereotype.Service;
import org.verdikt.chat.model.ConversationState;
import org.verdikt.chat.model.TopicMemory;

import java.util.List;

@Service
public class ChatTurnProcessor {

    private final TopicRouterService topicRouterService;
    private final TopicMemoryService topicMemoryService;

    public ChatTurnProcessor(TopicRouterService topicRouterService,
                             TopicMemoryService topicMemoryService) {
        this.topicRouterService = topicRouterService;
        this.topicMemoryService = topicMemoryService;
    }

    public TurnDecision decide(ConversationState state,
                               String message,
                               String selectedTopicId) {

        TopicRoutingDecision routing = topicRouterService.route(message, selectedTopicId, state);

        if (routing.getType() == TopicRoutingDecision.Type.ASK_USER) {
            return TurnDecision.askUserToChoose(state.getTopics());
        }

        if (routing.getType() == TopicRoutingDecision.Type.FIRST_MESSAGE) {
            return TurnDecision.firstMessage();
        }

        TopicMemory topic = findTopic(state, routing.getTopicId());
        state.setActiveTopicId(topic.getTopicId());
        return TurnDecision.useTopic(topic);
    }

    private TopicMemory findTopic(ConversationState state, String topicId) {
        return state.getTopics().stream()
                .filter(t -> t.getTopicId().equals(topicId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Topic not found: " + topicId));
    }

    public void initializeFirstTopic(ConversationState state,
                                     String userMessage,
                                     String rewrite,
                                     List<Long> qaIds) {
        TopicMemory topic = topicMemoryService.createInitialTopic(userMessage, rewrite, qaIds);
        state.getTopics().add(topic);
        state.setActiveTopicId(topic.getTopicId());
        state.setTurnCounter(1);
    }
}
