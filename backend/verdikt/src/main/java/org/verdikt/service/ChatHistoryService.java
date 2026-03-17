package org.verdikt.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.verdikt.chat.model.ConversationState;
import org.verdikt.dto.ChatMessageDto;
import org.verdikt.dto.ChatMessagesPageResponse;
import org.verdikt.entity.Chat;
import org.verdikt.entity.ChatMessage;
import org.verdikt.entity.User;
import org.verdikt.repository.ChatMessageRepository;
import org.verdikt.repository.ChatRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ChatHistoryService {

    private final ChatRepository chatRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ChatHistoryService(ChatRepository chatRepository, ChatMessageRepository chatMessageRepository) {
        this.chatRepository = chatRepository;
        this.chatMessageRepository = chatMessageRepository;
    }

    /**
     * Сохранить чат по результату вызова completions.
     * ragItemIds — список qaId RAG-элементов, использованных при генерации ответа.
     * conversationState — если не null, сохраняется в Chat.payloadJson (ConversationState).
     * @param skipUserMessage When true, user message was already saved (e.g. after choose_topic); only save assistant.
     */
    @Transactional
    @SuppressWarnings("unchecked")
    public String saveFromCompletion(User user,
                                     Map<String, Object> requestBody,
                                     Map<String, Object> llmResult,
                                     List<Long> ragItemIds,
                                     ConversationState conversationState,
                                     boolean skipUserMessage) {
        return doSaveFromCompletion(user, requestBody, llmResult, ragItemIds, conversationState, skipUserMessage);
    }

    public String saveFromCompletion(User user,
                                     Map<String, Object> requestBody,
                                     Map<String, Object> llmResult,
                                     List<Long> ragItemIds,
                                     ConversationState conversationState) {
        return doSaveFromCompletion(user, requestBody, llmResult, ragItemIds, conversationState, false);
    }

    private String doSaveFromCompletion(User user,
                                     Map<String, Object> requestBody,
                                     Map<String, Object> llmResult,
                                     List<Long> ragItemIds,
                                     ConversationState conversationState,
                                     boolean skipUserMessage) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Войдите в аккаунт");
        }

        // Определяем или создаём чат
        Object chatIdObj = requestBody.get("chatId");
        String chatKey = chatIdObj != null ? chatIdObj.toString() : null;
        if (chatKey == null || chatKey.isBlank()) {
            chatKey = java.util.UUID.randomUUID().toString();
        }

        String finalChatKey = chatKey;
        Chat chat = chatRepository.findByUserIdAndChatKey(user.getId(), chatKey)
                .orElseGet(() -> {
                    Chat c = new Chat();
                    c.setUser(user);
                    c.setChatKey(finalChatKey);
                    c.setCreatedAt(Instant.now());
                    return c;
                });

        if (conversationState != null) {
            try {
                chat.setPayloadJson(objectMapper.writeValueAsString(conversationState));
            } catch (JsonProcessingException e) {
                chat.setPayloadJson("{\"activeTopicId\":null,\"turnCounter\":0,\"topics\":[]}");
            }
        } else if (chat.getPayloadJson() == null) {
            try {
                Map<String, Object> minimalPayload = new java.util.HashMap<>();
                minimalPayload.put("id", finalChatKey);
                minimalPayload.put("timestamp", System.currentTimeMillis());
                chat.setPayloadJson(objectMapper.writeValueAsString(minimalPayload));
            } catch (JsonProcessingException e) {
                chat.setPayloadJson("{\"id\":\"" + finalChatKey + "\"}");
            }
        }

        // Ensure chat is persisted before saving messages to avoid transient association errors
        chat.setUpdatedAt(Instant.now());
        chat = chatRepository.save(chat);

        String userContent = extractLastUserMessageContent(requestBody);
        String assistantContent = extractAssistantContent(llmResult);

        if (!skipUserMessage && userContent != null && !userContent.isBlank()) {
            ChatMessage userMsg = new ChatMessage();
            userMsg.setChat(chat);
            userMsg.setRole("user");
            userMsg.setContent(userContent);
            chatMessageRepository.save(userMsg);
        }

        if (assistantContent != null && !assistantContent.isBlank()) {
            ChatMessage aiMsg = new ChatMessage();
            aiMsg.setChat(chat);
            aiMsg.setRole("assistant");
            aiMsg.setContent(assistantContent);
            if (ragItemIds != null && !ragItemIds.isEmpty()) {
                try {
                    aiMsg.setRagItemIdsJson(objectMapper.writeValueAsString(ragItemIds));
                } catch (JsonProcessingException e) {
                    // ignore: поле остаётся null
                }
            }
            chatMessageRepository.save(aiMsg);
        }

        return chatKey;
    }

    /**
     * Parse ConversationState from chat payloadJson. Returns empty state if payload is old format or invalid.
     */
    public ConversationState parseConversationState(Chat chat) {
        String json = chat != null ? chat.getPayloadJson() : null;
        if (json == null || json.isBlank()) {
            return new ConversationState();
        }
        try {
            ConversationState state = objectMapper.readValue(json, ConversationState.class);
            return state != null ? state : new ConversationState();
        } catch (Exception e) {
            return new ConversationState();
        }
    }

    /**
     * Save only user message (e.g. before returning choose_topic). Returns the saved message id.
     */
    @Transactional
    public Long saveUserMessageOnly(User user, String chatKey, String messageContent) {
        if (user == null || messageContent == null || messageContent.isBlank()) return null;
        Chat chat = chatRepository.findByUserIdAndChatKey(user.getId(), chatKey)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Чат не найден"));
        ChatMessage msg = new ChatMessage();
        msg.setChat(chat);
        msg.setRole("user");
        msg.setContent(messageContent);
        msg = chatMessageRepository.save(msg);
        return msg.getId();
    }

    @Transactional
    public Map<String, Object> saveChat(User user, String chatKey, Map<String, Object> payload) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Войдите в аккаунт");
        }
        if (chatKey == null || chatKey.isBlank()) {
            chatKey = java.util.UUID.randomUUID().toString();
        }
        try {
            if (payload == null) {
                payload = new java.util.HashMap<>();
            }
            payload.putIfAbsent("id", chatKey);
            payload.putIfAbsent("timestamp", System.currentTimeMillis());

            String json = objectMapper.writeValueAsString(payload);

            String finalChatKey = chatKey;
            Chat chat = chatRepository.findByUserIdAndChatKey(user.getId(), chatKey)
                    .orElseGet(() -> {
                        Chat c = new Chat();
                        c.setUser(user);
                        c.setChatKey(finalChatKey);
                        c.setCreatedAt(Instant.now());
                        return c;
                    });

            chat.setPayloadJson(json);
            chat.setUpdatedAt(Instant.now());
            chatRepository.save(chat);

            return payload;
        } catch (JsonProcessingException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Некорректный формат чата");
        }
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getChats(User user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Войдите в аккаунт");
        }
        List<Chat> chats = chatRepository.findByUserIdOrderByUpdatedAtDesc(user.getId());
        return chats.stream()
                .map(this::toPayload)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getChat(User user, String chatKey) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Войдите в аккаунт");
        }
        return chatRepository.findByUserIdAndChatKey(user.getId(), chatKey)
                .map(this::toPayload)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Чат не найден"));
    }

    @Transactional
    public void deleteChat(User user, String chatKey) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Войдите в аккаунт");
        }
        chatRepository.deleteByUserIdAndChatKey(user.getId(), chatKey);
    }

    /**
     * Пагинированный список сообщений чата. Доступ только у владельца чата или админа.
     * Для админа можно передать userId (query), чтобы получить сообщения чата другого пользователя.
     */
    @Transactional(readOnly = true)
    public ChatMessagesPageResponse getMessages(User user, String chatId, Long userIdParam, Pageable pageable) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Войдите в аккаунт");
        }
        if (chatId == null || chatId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Идентификатор чата обязателен");
        }
        boolean isAdmin = "ADMIN".equals(user.getRole());
        Long ownerId = (isAdmin && userIdParam != null) ? userIdParam : user.getId();
        Chat chat = chatRepository.findByUserIdAndChatKey(ownerId, chatId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Чат не найден"));
        if (!isAdmin && !chat.getUser().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Нет доступа к этому чату");
        }
        Page<ChatMessage> page = chatMessageRepository.findByChatOrderByCreatedAtAsc(chat, pageable);
        List<ChatMessageDto> content = page.getContent().stream()
                .map(this::toMessageDto)
                .collect(Collectors.toList());
        return new ChatMessagesPageResponse(
                content,
                page.getTotalElements(),
                page.getTotalPages(),
                page.getSize(),
                page.getNumber()
        );
    }

    private ChatMessageDto toMessageDto(ChatMessage m) {
        ChatMessageDto dto = new ChatMessageDto(m.getRole(), m.getContent());
        dto.setId(m.getId());
        dto.setCreatedAt(m.getCreatedAt());
        if (m.getRagItemIdsJson() != null && !m.getRagItemIdsJson().isBlank()) {
            try {
                List<Long> ids = objectMapper.readValue(m.getRagItemIdsJson(), new TypeReference<List<Long>>() {});
                dto.setRagItemIds(ids);
            } catch (Exception ignored) {
                // leave null
            }
        }
        return dto;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> toPayload(Chat chat) {
        try {
            Map<String, Object> map = objectMapper.readValue(chat.getPayloadJson(), new TypeReference<Map<String, Object>>() {});
            if (map == null) {
                map = new java.util.HashMap<>();
            }
            if (!map.containsKey("id")) {
                map.put("id", chat.getChatKey());
            }
            if (!map.containsKey("timestamp")) {
                map.put("timestamp", chat.getUpdatedAt() != null ? chat.getUpdatedAt().toEpochMilli() : Instant.now().toEpochMilli());
            }
            return map;
        } catch (Exception e) {
            Map<String, Object> fallback = new java.util.HashMap<>();
            fallback.put("id", chat.getChatKey());
            fallback.put("title", "Чат");
            fallback.put("messages", new ArrayList<>());
            fallback.put("timestamp", chat.getUpdatedAt() != null ? chat.getUpdatedAt().toEpochMilli() : Instant.now().toEpochMilli());
            return fallback;
        }
    }

    /**
     * Извлекает контент ответа ассистента из разных возможных форматов ответа LLM.
     */
    @SuppressWarnings("unchecked")
    private String extractAssistantContent(Map<String, Object> data) {
        try {
            Object choicesObj = data.get("choices");
            if (choicesObj instanceof java.util.List<?> list && !list.isEmpty()) {
                Object first = list.get(0);
                if (first instanceof java.util.Map<?, ?> m) {
                    Object messageObj = m.get("message");
                    if (messageObj instanceof java.util.Map<?, ?> msgMap) {
                        Object contentObj = msgMap.get("content");
                        if (contentObj instanceof String s && !s.isBlank()) {
                            return s.trim();
                        }
                    }
                    Object textObj = m.get("text");
                    if (textObj instanceof String s2 && !s2.isBlank()) {
                        return s2.trim();
                    }
                }
            }
            Object responseObj = data.get("response");
            if (responseObj instanceof String rs && !rs.isBlank()) {
                return rs.trim();
            }
            Object contentObj = data.get("content");
            if (contentObj instanceof String s3 && !s3.isBlank()) {
                return s3.trim();
            }
            Object messageObj = data.get("message");
            if (messageObj instanceof java.util.Map<?, ?> msgMap) {
                Object c = ((java.util.Map<String, Object>) msgMap).get("content");
                if (c instanceof String s4 && !s4.isBlank()) {
                    return s4.trim();
                }
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    /**
     * Извлекает текст последнего пользовательского сообщения из body запроса.
     */
    @SuppressWarnings("unchecked")
    private String extractLastUserMessageContent(Map<String, Object> body) {
        Object messagesObj = body.get("messages");
        if (!(messagesObj instanceof java.util.List<?> rawList) || rawList.isEmpty()) {
            return null;
        }
        for (int i = rawList.size() - 1; i >= 0; i--) {
            Object o = rawList.get(i);
            if (!(o instanceof java.util.Map<?, ?> m)) continue;
            Object roleObj = m.get("role");
            if (!"user".equals(roleObj)) continue;
            Object contentObj = m.get("content");
            if (contentObj instanceof String s && !s.isBlank()) {
                return s;
            }
        }
        return null;
    }
}

