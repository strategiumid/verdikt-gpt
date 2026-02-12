package org.verdikt.service;

import org.verdikt.dto.QuestionRequest;
import org.verdikt.dto.QuestionResponse;
import org.verdikt.entity.Question;
import org.verdikt.entity.User;
import org.verdikt.repository.QuestionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class QuestionService {

    private final QuestionRepository questionRepository;

    public QuestionService(QuestionRepository questionRepository) {
        this.questionRepository = questionRepository;
    }

    @Transactional
    public QuestionResponse createQuestion(User author, QuestionRequest request) {
        Question question = new Question();
        question.setAuthor(author);
        question.setContent(request.getContent().trim());
        Question saved = questionRepository.save(question);
        return QuestionResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<QuestionResponse> getRecentQuestions() {
        return questionRepository.findTop50ByOrderByCreatedAtDesc()
                .stream()
                .map(QuestionResponse::from)
                .collect(Collectors.toList());
    }
}

