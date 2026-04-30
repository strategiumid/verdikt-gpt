package org.verdikt.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.verdikt.dto.AdminChatResponse;
import org.verdikt.dto.QuestionResponse;
import org.verdikt.dto.SetRoleRequest;
import org.verdikt.dto.SetSubscriptionRequest;
import org.verdikt.dto.UserResponse;
import org.verdikt.entity.Chat;
import org.verdikt.entity.User;
import org.verdikt.repository.ChatRepository;
import org.verdikt.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@Service
public class AdminService {

    private final UserRepository userRepository;
    private final ChatRepository chatRepository;
    private final QuestionService questionService;
    private final ObjectMapper objectMapper;

    public AdminService(UserRepository userRepository,
                        ChatRepository chatRepository,
                        QuestionService questionService,
                        ObjectMapper objectMapper) {
        this.userRepository = userRepository;
        this.chatRepository = chatRepository;
        this.questionService = questionService;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public Page<UserResponse> listUsers(Pageable pageable,
                                        String search,
                                        String role,
                                        String subscription,
                                        Boolean banned,
                                        Boolean deleted,
                                        Boolean emailVerified) {
        Specification<User> spec = Specification.where(null);

        if (search != null && !search.isBlank()) {
            String like = "%" + search.trim().toLowerCase() + "%";
            spec = spec.and((root, query, cb) -> cb.or(
                    cb.like(cb.lower(root.get("email")), like),
                    cb.like(cb.lower(cb.coalesce(root.get("name"), "")), like)
            ));
        }
        if (role != null && !role.isBlank()) {
            String normalizedRole = role.trim().toUpperCase();
            spec = spec.and((root, query, cb) -> cb.equal(cb.upper(root.get("role")), normalizedRole));
        }
        if (subscription != null && !subscription.isBlank()) {
            String normalizedSubscription = subscription.trim().toLowerCase();
            spec = spec.and((root, query, cb) -> cb.equal(cb.lower(root.get("subscription")), normalizedSubscription));
        }
        if (banned != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("banned"), banned));
        }
        if (deleted != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("deleted"), deleted));
        }
        if (emailVerified != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("emailVerified"), emailVerified));
        }

        return userRepository.findAll(spec, pageable).map(UserResponse::from);
    }

    @Transactional
    public UserResponse banUser(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Пользователь не найден"));
        user.setBanned(true);
        user = userRepository.save(user);
        return UserResponse.from(user);
    }

    @Transactional
    public UserResponse unbanUser(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Пользователь не найден"));
        user.setBanned(false);
        user = userRepository.save(user);
        return UserResponse.from(user);
    }

    @Transactional
    public UserResponse setUserRole(Long targetId, SetRoleRequest request) {
        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Пользователь не найден"));
        if ("ADMIN".equals(target.getRole()) && "USER".equals(request.getRole())) {
            long adminCount = userRepository.findAll().stream()
                    .filter(u -> "ADMIN".equals(u.getRole()))
                    .count();
            if (adminCount <= 1) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Нельзя снять роль администратора у последнего админа");
            }
        }
        target.setRole(request.getRole().trim());
        target = userRepository.save(target);
        return UserResponse.from(target);
    }

    @Transactional
    public UserResponse setUserSubscription(Long targetId, SetSubscriptionRequest request) {
        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Пользователь не найден"));
        target.setSubscription(request.getSubscription());
        target = userRepository.save(target);
        return UserResponse.from(target);
    }

    @Transactional(readOnly = true)
    public Page<QuestionResponse> listQuestions(Pageable pageable, User currentUser) {
        return questionService.getQuestionsPage(pageable, currentUser);
    }

    @Transactional(readOnly = true)
    public Page<AdminChatResponse> listUserChats(Long userId,
                                                 Pageable pageable,
                                                 String search,
                                                 Boolean isPrivate,
                                                 Boolean deleted,
                                                 String sortBy,
                                                 String sortDir) {
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "userId обязателен");
        }
        if (!userRepository.existsById(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Пользователь не найден");
        }

        Pageable effectivePageable = withSafeSorting(pageable, sortBy, sortDir);
        Specification<Chat> spec = Specification.where((root, query, cb) -> cb.equal(root.get("user").get("id"), userId));

        if (search != null && !search.isBlank()) {
            String like = "%" + search.trim().toLowerCase() + "%";
            spec = spec.and((root, query, cb) -> cb.or(
                    cb.like(cb.lower(root.get("chatKey")), like),
                    cb.like(cb.lower(cb.coalesce(root.get("payloadJson"), "")), like)
            ));
        }
        if (isPrivate != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("isPrivate"), isPrivate));
        }
        if (deleted != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("isDeleted"), deleted));
        }

        return chatRepository.findAll(spec, effectivePageable)
                .map(chat -> AdminChatResponse.from(chat, extractTitle(chat.getPayloadJson())));
    }

    private Pageable withSafeSorting(Pageable pageable, String sortBy, String sortDir) {
        String requestedSortBy = (sortBy == null || sortBy.isBlank()) ? "updatedAt" : sortBy.trim();
        String normalizedSortBy = switch (requestedSortBy) {
            case "createdAt" -> "createdAt";
            case "chatKey" -> "chatKey";
            case "id" -> "id";
            case "isPrivate" -> "isPrivate";
            case "isDeleted" -> "isDeleted";
            default -> "updatedAt";
        };

        Sort.Direction direction = "asc".equalsIgnoreCase(sortDir) ? Sort.Direction.ASC : Sort.Direction.DESC;
        return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by(direction, normalizedSortBy));
    }

    private String extractTitle(String payloadJson) {
        if (payloadJson == null || payloadJson.isBlank()) {
            return "Чат";
        }
        try {
            Map<String, Object> map = objectMapper.readValue(payloadJson, new TypeReference<Map<String, Object>>() {});
            Object title = map.get("title");
            if (title instanceof String s && !s.isBlank()) {
                return s.trim();
            }
        } catch (Exception ignored) {
            // Ignore malformed payload and fallback to default title.
        }
        return "Чат";
    }

    @Transactional
    public void deleteQuestion(Long questionId) {
        questionService.deleteQuestion(questionId);
    }

    @Transactional
    public QuestionResponse setQuestionResolved(Long questionId, boolean resolved) {
        return questionService.setResolved(questionId, resolved);
    }
}
