package org.verdikt.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.verdikt.entity.Chat;
import org.verdikt.entity.ChatMessage;
import org.verdikt.entity.User;
import org.verdikt.repository.ChatMessageRepository;
import org.verdikt.repository.ChatRepository;
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
     * Сохранить чат по результату вызова completions:
     * берём исходный body (model, messages, chatId) и ответ LLM,
     * добавляем сообщение ассистента и сохраняем в БД.
     *
     * Возвращает итоговый идентификатор чата (генерируется, если не был задан).
     */
    @Transactional
    @SuppressWarnings("unchecked")
    public String saveFromCompletion(User user,
                                     Map<String, Object> requestBody,
                                     Map<String, Object> llmResult) {
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

        // Ensure payloadJson is not null (column is NOT NULL in schema)
        if (chat.getPayloadJson() == null) {
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

        // Находим последнее пользовательское сообщение в запросе
        String userContent = extractLastUserMessageContent(requestBody);
        String assistantContent = extractAssistantContent(llmResult);

        if (userContent != null && !userContent.isBlank()) {
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
            chatMessageRepository.save(aiMsg);
        }

        return chatKey;
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

