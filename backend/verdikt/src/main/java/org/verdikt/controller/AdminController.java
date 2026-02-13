package org.verdikt.controller;

import org.verdikt.dto.UserResponse;
import org.verdikt.entity.Question;
import org.verdikt.entity.User;
import org.verdikt.repository.QuestionRepository;
import org.verdikt.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Простая админ-панель через REST.
 * Админ определяется по флагу user.isAdmin() и может:
 * - назначать других админов по email
 * - удалять вопросы
 * - просматривать список всех пользователей
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final UserRepository userRepository;
    private final QuestionRepository questionRepository;

    public AdminController(UserRepository userRepository, QuestionRepository questionRepository) {
        this.userRepository = userRepository;
        this.questionRepository = questionRepository;
    }

    private boolean isAdmin(User user) {
        return user != null && user.isAdmin();
    }

    /**
     * GET /api/admin/users — получить список всех пользователей (только для админов).
     */
    @GetMapping("/users")
    public ResponseEntity<List<UserResponse>> getAllUsers(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(required = false) String search
    ) {
        if (!isAdmin(currentUser)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        List<User> users;
        if (search != null && !search.trim().isEmpty()) {
            String searchLower = search.trim().toLowerCase();
            users = userRepository.findAll().stream()
                    .filter(u -> (u.getEmail() != null && u.getEmail().toLowerCase().contains(searchLower))
                            || (u.getName() != null && u.getName().toLowerCase().contains(searchLower)))
                    .collect(Collectors.toList());
        } else {
            users = userRepository.findAll();
        }

        List<UserResponse> responses = users.stream()
                .map(UserResponse::from)
                .collect(Collectors.toList());

        return ResponseEntity.ok(responses);
    }

    @PostMapping("/users/make-admin")
    public ResponseEntity<UserResponse> makeAdmin(
            @AuthenticationPrincipal User currentUser,
            @RequestParam("email") String email
    ) {
        if (!isAdmin(currentUser)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Optional<User> targetOpt = userRepository.findByEmail(email.trim().toLowerCase());
        if (targetOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }

        User target = targetOpt.get();
        target.setAdmin(true);
        userRepository.save(target);

        return ResponseEntity.ok(UserResponse.from(target));
    }

    @DeleteMapping("/questions/{id}")
    public ResponseEntity<Void> deleteQuestion(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id
    ) {
        if (!isAdmin(currentUser)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Question q = questionRepository.findById(id).orElse(null);
        if (q == null) {
            return ResponseEntity.notFound().build();
        }
        questionRepository.delete(q);
        return ResponseEntity.noContent().build();
    }
}

