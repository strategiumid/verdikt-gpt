package org.verdikt.controller;

import org.verdikt.dto.AnalyticsResponse;
import org.verdikt.dto.QuestionResponse;
import org.verdikt.dto.SetRoleRequest;
import org.verdikt.dto.SetSubscriptionRequest;
import org.verdikt.dto.UserResponse;
import org.verdikt.entity.User;
import org.verdikt.service.AdminService;
import org.verdikt.service.FeedbackService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;

/**
 * Эндпоинты админ-панели. Доступ только для пользователей с ролью ADMIN.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService adminService;
    private final FeedbackService feedbackService;

    public AdminController(AdminService adminService, FeedbackService feedbackService) {
        this.adminService = adminService;
        this.feedbackService = feedbackService;
    }

    @SuppressWarnings("unchecked")
    private <T> ResponseEntity<T> forbidden() {
        return (ResponseEntity<T>) ResponseEntity.status(403).build();
    }

    private boolean isAdmin(User user) {
        return user != null && "ADMIN".equals(user.getRole());
    }

    @GetMapping("/users")
    public ResponseEntity<Page<UserResponse>> listUsers(
            @AuthenticationPrincipal User user,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        if (!isAdmin(user)) return forbidden();
        return ResponseEntity.ok(adminService.listUsers(pageable));
    }

    @PatchMapping("/users/{id}/ban")
    public ResponseEntity<UserResponse> banUser(
            @AuthenticationPrincipal User user,
            @PathVariable Long id
    ) {
        if (!isAdmin(user)) return forbidden();
        return ResponseEntity.ok(adminService.banUser(id));
    }

    @PatchMapping("/users/{id}/unban")
    public ResponseEntity<UserResponse> unbanUser(
            @AuthenticationPrincipal User user,
            @PathVariable Long id
    ) {
        if (!isAdmin(user)) return forbidden();
        return ResponseEntity.ok(adminService.unbanUser(id));
    }

    @PatchMapping("/users/{id}/role")
    public ResponseEntity<UserResponse> setUserRole(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @Valid @RequestBody SetRoleRequest request
    ) {
        if (!isAdmin(user)) return forbidden();
        return ResponseEntity.ok(adminService.setUserRole(id, request));
    }

    @PatchMapping("/users/{id}/subscription")
    public ResponseEntity<UserResponse> setUserSubscription(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @Valid @RequestBody SetSubscriptionRequest request
    ) {
        if (!isAdmin(user)) return forbidden();
        return ResponseEntity.ok(adminService.setUserSubscription(id, request));
    }

    @GetMapping("/questions")
    public ResponseEntity<Page<QuestionResponse>> listQuestions(
            @AuthenticationPrincipal User user,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        if (!isAdmin(user)) return forbidden();
        return ResponseEntity.ok(adminService.listQuestions(pageable, user));
    }

    @DeleteMapping("/questions/{id}")
    public ResponseEntity<Void> deleteQuestion(
            @AuthenticationPrincipal User user,
            @PathVariable Long id
    ) {
        if (!isAdmin(user)) return forbidden();
        adminService.deleteQuestion(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/questions/{id}/resolve")
    public ResponseEntity<QuestionResponse> setQuestionResolved(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @RequestBody(required = false) java.util.Map<String, Boolean> body
    ) {
        if (!isAdmin(user)) return forbidden();
        boolean resolved = body != null && Boolean.TRUE.equals(body.get("resolved"));
        return ResponseEntity.ok(adminService.setQuestionResolved(id, resolved));
    }

    @GetMapping("/feedback/analytics")
    public ResponseEntity<AnalyticsResponse> getFeedbackAnalytics(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "20") int limit
    ) {
        if (!isAdmin(user)) return forbidden();
        return ResponseEntity.ok(feedbackService.getAllAnalyticsForAdmin(limit));
    }
}
