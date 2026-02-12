package org.verdikt.service;

import org.verdikt.dto.QuestionRequest;
import org.verdikt.dto.QuestionResponse;
import org.verdikt.entity.Question;
import org.verdikt.entity.QuestionComment;
import org.verdikt.entity.QuestionReaction;
import org.verdikt.entity.User;
import org.verdikt.repository.QuestionCommentRepository;
import org.verdikt.repository.QuestionReactionRepository;
import org.verdikt.repository.QuestionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class QuestionService {

    private final QuestionRepository questionRepository;
    private final QuestionReactionRepository reactionRepository;
    private final QuestionCommentRepository commentRepository;

    public QuestionService(QuestionRepository questionRepository,
                           QuestionReactionRepository reactionRepository,
                           QuestionCommentRepository commentRepository) {
        this.questionRepository = questionRepository;
        this.reactionRepository = reactionRepository;
        this.commentRepository = commentRepository;
    }

    @Transactional
    public QuestionResponse createQuestion(User author, QuestionRequest request) {
        Question question = new Question();
        question.setAuthor(author);
        question.setContent(request.getContent().trim());
        question.setLikesCount(0);
        question.setDislikesCount(0);
        question.setCommentsCount(0);
        Question saved = questionRepository.save(question);
        return mapToResponse(saved, author);
    }

    @Transactional(readOnly = true)
    public List<QuestionResponse> getRecentQuestions(User currentUser) {
        return questionRepository.findTop50ByOrderByCreatedAtDesc()
                .stream()
                .map(q -> mapToResponse(q, currentUser))
                .collect(Collectors.toList());
    }

    @Transactional
    public QuestionResponse updateStats(Long questionId, int likes, int dislikes, int comments) {
        Question q = questionRepository.findById(questionId)
                .orElseThrow(() -> new IllegalArgumentException("Вопрос не найден"));
        q.setLikesCount(Math.max(likes, 0));
        q.setDislikesCount(Math.max(dislikes, 0));
        q.setCommentsCount(Math.max(comments, 0));
        Question saved = questionRepository.save(q);
        return mapToResponse(saved, null);
    }

    @Transactional
    public QuestionResponse toggleLike(Long questionId, User user) {
        return toggleReaction(questionId, user, QuestionReaction.Type.LIKE);
    }

    @Transactional
    public QuestionResponse toggleDislike(Long questionId, User user) {
        return toggleReaction(questionId, user, QuestionReaction.Type.DISLIKE);
    }

    @Transactional
    public QuestionResponse addComment(Long questionId, User user, String content) {
        Question q = questionRepository.findById(questionId)
                .orElseThrow(() -> new IllegalArgumentException("Вопрос не найден"));
        QuestionComment comment = new QuestionComment();
        comment.setQuestion(q);
        comment.setAuthor(user);
        comment.setContent(content.trim());
        commentRepository.save(comment);

        // Обновляем счётчик комментариев из репозитория
        long commentsCount = commentRepository.countByQuestionId(questionId);
        q.setCommentsCount((int) commentsCount);
        Question saved = questionRepository.save(q);
        return mapToResponse(saved, user);
    }

    private QuestionResponse toggleReaction(Long questionId, User user, QuestionReaction.Type type) {
        Question q = questionRepository.findById(questionId)
                .orElseThrow(() -> new IllegalArgumentException("Вопрос не найден"));

        var existingOpt = reactionRepository.findByQuestionIdAndUserId(questionId, user.getId());

        if (existingOpt.isPresent()) {
            QuestionReaction existing = existingOpt.get();
            if (existing.getType() == type) {
                // Снимаем текущую реакцию
                reactionRepository.delete(existing);
            } else {
                // Меняем лайк на дизлайк или наоборот
                existing.setType(type);
                reactionRepository.save(existing);
            }
        } else {
            // Создаём новую реакцию
            QuestionReaction reaction = new QuestionReaction();
            reaction.setQuestion(q);
            reaction.setUser(user);
            reaction.setType(type);
            reactionRepository.save(reaction);
        }

        // Пересчитываем счётчики
        long likes = reactionRepository.countByQuestionIdAndType(questionId, QuestionReaction.Type.LIKE);
        long dislikes = reactionRepository.countByQuestionIdAndType(questionId, QuestionReaction.Type.DISLIKE);
        q.setLikesCount((int) likes);
        q.setDislikesCount((int) dislikes);
        Question saved = questionRepository.save(q);

        return mapToResponse(saved, user);
    }

    private QuestionResponse mapToResponse(Question question, User currentUser) {
        QuestionResponse r = QuestionResponse.from(question);
        if (currentUser != null) {
            reactionRepository.findByQuestionIdAndUserId(question.getId(), currentUser.getId())
                    .ifPresent(reaction -> {
                        r.setLikedByCurrentUser(reaction.getType() == QuestionReaction.Type.LIKE);
                        r.setDislikedByCurrentUser(reaction.getType() == QuestionReaction.Type.DISLIKE);
                    });
        }
        return r;
    }
}

