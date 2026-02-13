package org.verdikt.controller;

import org.verdikt.dto.CommentRequest;
import org.verdikt.dto.CommentResponse;
import org.verdikt.dto.QuestionRequest;
import org.verdikt.dto.QuestionResponse;
import org.verdikt.dto.ReactionRequest;
import org.verdikt.entity.User;
import org.verdikt.service.QuestionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.List;

/**
 * Эндпоинты для работы с вопросами, лайками/дизлайками и комментариями.
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
     * GET /api/questions — последние вопросы (счётчики лайков/дизлайков/комментариев, isLiked/isDisliked для текущего пользователя).
     */
    @GetMapping
    public List<QuestionResponse> list(@AuthenticationPrincipal User user) {
        return questionService.getRecentQuestions(user);
    }

    /**
     * POST /api/questions/{id}/reaction — поставить лайк или дизлайк. Тело: { "type": "like" | "dislike" }.
     */
    @PostMapping("/{id}/reaction")
    public ResponseEntity<QuestionResponse> setReaction(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @Valid @RequestBody ReactionRequest request
    ) {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        QuestionResponse response = questionService.setReaction(user, id, request);
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/questions/{id}/comments — список комментариев к вопросу.
     */
    @GetMapping("/{id}/comments")
    public List<CommentResponse> getComments(@PathVariable Long id) {
        return questionService.getComments(id);
    }

    /**
     * POST /api/questions/{id}/comments — добавить комментарий. Тело: { "content": "..." }.
     */
    @PostMapping("/{id}/comments")
    public ResponseEntity<CommentResponse> addComment(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @Valid @RequestBody CommentRequest request
    ) {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        CommentResponse response = questionService.addComment(user, id, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}

