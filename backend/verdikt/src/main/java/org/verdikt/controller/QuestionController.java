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
}

