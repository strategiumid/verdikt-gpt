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
     */
    @GetMapping
    public List<QuestionResponse> list() {
        return questionService.getRecentQuestions();
    }

    /**
     * PATCH /api/questions/{id}/stats — обновление счётчиков лайков/дизлайков/комментариев.
     * Сейчас вызывается фронтендом после каждого действия.
     */
    @PatchMapping("/{id}/stats")
    public ResponseEntity<QuestionResponse> updateStats(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @RequestBody StatsRequest body
    ) {
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        QuestionResponse response = questionService.updateStats(id, body.getLikes(), body.getDislikes(), body.getComments());
        return ResponseEntity.ok(response);
    }

    public static class StatsRequest {
        private int likes;
        private int dislikes;
        private int comments;

        public int getLikes() {
            return likes;
        }

        public void setLikes(int likes) {
            this.likes = likes;
        }

        public int getDislikes() {
            return dislikes;
        }

        public void setDislikes(int dislikes) {
            this.dislikes = dislikes;
        }

        public int getComments() {
            return comments;
        }

        public void setComments(int comments) {
            this.comments = comments;
        }
    }
}

