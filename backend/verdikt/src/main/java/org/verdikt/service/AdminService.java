package org.verdikt.service;

import org.verdikt.dto.QuestionResponse;
import org.verdikt.dto.SetRoleRequest;
import org.verdikt.dto.UserResponse;
import org.verdikt.entity.User;
import org.verdikt.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminService {

    private final UserRepository userRepository;
    private final QuestionService questionService;

    public AdminService(UserRepository userRepository, QuestionService questionService) {
        this.userRepository = userRepository;
        this.questionService = questionService;
    }

    @Transactional(readOnly = true)
    public Page<UserResponse> listUsers(Pageable pageable) {
        return userRepository.findAll(pageable).map(UserResponse::from);
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

    @Transactional(readOnly = true)
    public Page<QuestionResponse> listQuestions(Pageable pageable, User currentUser) {
        return questionService.getQuestionsPage(pageable, currentUser);
    }

    @Transactional
    public void deleteQuestion(Long questionId) {
        questionService.deleteQuestion(questionId);
    }
}
