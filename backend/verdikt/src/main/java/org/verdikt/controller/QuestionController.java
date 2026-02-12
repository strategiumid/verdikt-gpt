package org.verdikt.controller;

import org.verdikt.dto.QuestionRequest;
import org.verdikt.dto.QuestionResponse;
import org.verdikt.entity.User;
import org.verdikt.service.QuestionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.List;

/**
 * Эндпоинты для работы с вопросами.
 * Авторизованные пользователи могут создавать вопросы, а также смотреть список последних.
 */
@RestController
@RequestMapping("/api/questions")
public class QuestionController {

    private final QuestionService questionService;

    public QuestionController(QuestionService questionService) {
        this.questionService = questionService;
    }

    /**
     * POST /api/questions — создать новый вопрос от текущего пользователя.
     */
    @PostMapping
    public ResponseEntity<QuestionResponse> create(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody QuestionRequest request
    ) {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        QuestionResponse response = questionService.createQuestion(user, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * GET /api/questions — последние вопросы (пока без фильтрации по адресату).
     * Использует текущего пользователя для определения likedByCurrentUser / dislikedByCurrentUser.
     */
    @GetMapping
    public List<QuestionResponse> list(@AuthenticationPrincipal User user) {
        return questionService.getRecentQuestions(user);
    }

    /**
     * POST /api/questions/{id}/like — поставить/снять лайк.
     */
    @PostMapping("/{id}/like")
    public ResponseEntity<QuestionResponse> like(
            @AuthenticationPrincipal User user,
            @PathVariable Long id
    ) {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        QuestionResponse response = questionService.toggleLike(id, user);
        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/questions/{id}/dislike — поставить/снять дизлайк.
     */
    @PostMapping("/{id}/dislike")
    public ResponseEntity<QuestionResponse> dislike(
            @AuthenticationPrincipal User user,
            @PathVariable Long id
    ) {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        QuestionResponse response = questionService.toggleDislike(id, user);
        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/questions/{id}/comments — добавить комментарий к вопросу.
     */
    @PostMapping("/{id}/comments")
    public ResponseEntity<QuestionResponse> comment(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @RequestBody CommentRequest body
    ) {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        if (body.getContent() == null || body.getContent().trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        QuestionResponse response = questionService.addComment(id, user, body.getContent());
        return ResponseEntity.ok(response);
    }

    public static class CommentRequest {
        private String content;

        public String getContent() {
            return content;
        }

        public void setContent(String content) {
            this.content = content;
        }
    }
}

