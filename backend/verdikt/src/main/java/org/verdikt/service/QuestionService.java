package org.verdikt.service;

import org.verdikt.dto.CommentRequest;
import org.verdikt.dto.CommentResponse;
import org.verdikt.dto.QuestionRequest;
import org.verdikt.dto.QuestionResponse;
import org.verdikt.dto.ReactionRequest;
import org.verdikt.entity.Question;
import org.verdikt.entity.QuestionComment;
import org.verdikt.entity.QuestionReaction;
import org.verdikt.entity.User;
import org.verdikt.repository.QuestionCommentRepository;
import org.verdikt.repository.QuestionReactionRepository;
import org.verdikt.repository.QuestionRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

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
        Question saved = questionRepository.save(question);
        return toResponse(saved, null);
    }

    @Transactional(readOnly = true)
    public List<QuestionResponse> getRecentQuestions(User currentUser) {
        List<Question> questions = questionRepository.findTop50ByOrderByCreatedAtDesc();
        return questions.stream()
                .map(q -> toResponse(q, currentUser))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Page<QuestionResponse> getQuestionsPage(Pageable pageable, User currentUser) {
        return questionRepository.findAllByOrderByCreatedAtDesc(pageable)
                .map(q -> toResponse(q, currentUser));
    }

    @Transactional
    public void deleteQuestion(Long questionId) {
        if (!questionRepository.existsById(questionId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Вопрос не найден");
        }
        reactionRepository.deleteByQuestionId(questionId);
        commentRepository.deleteByQuestionId(questionId);
        questionRepository.deleteById(questionId);
    }

    private QuestionResponse toResponse(Question question, User currentUser) {
        QuestionResponse r = QuestionResponse.from(question);
        long likes = reactionRepository.countByQuestionIdAndType(question.getId(), QuestionReaction.Type.LIKE);
        long dislikes = reactionRepository.countByQuestionIdAndType(question.getId(), QuestionReaction.Type.DISLIKE);
        long comments = commentRepository.countByQuestionId(question.getId());
        r.setLikesCount(likes);
        r.setDislikesCount(dislikes);
        r.setCommentsCount(comments);
        if (currentUser != null) {
            reactionRepository.findByQuestionIdAndUserId(question.getId(), currentUser.getId())
                    .ifPresent(reaction -> {
                        r.setIsLiked(reaction.getType() == QuestionReaction.Type.LIKE);
                        r.setIsDisliked(reaction.getType() == QuestionReaction.Type.DISLIKE);
                    });
        }
        return r;
    }

    @Transactional
    public QuestionResponse setReaction(User user, Long questionId, ReactionRequest request) {
        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Вопрос не найден"));
        QuestionReaction.Type type = "like".equalsIgnoreCase(request.getType().trim())
                ? QuestionReaction.Type.LIKE
                : QuestionReaction.Type.DISLIKE;
        QuestionReaction reaction = reactionRepository.findByQuestionIdAndUserId(questionId, user.getId())
                .orElseGet(() -> {
                    QuestionReaction r = new QuestionReaction();
                    r.setQuestion(question);
                    r.setUser(user);
                    return r;
                });
        reaction.setType(type);
        reactionRepository.save(reaction);
        return toResponse(question, user);
    }

    @Transactional
    public CommentResponse addComment(User user, Long questionId, CommentRequest request) {
        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Вопрос не найден"));
        QuestionComment comment = new QuestionComment();
        comment.setQuestion(question);
        comment.setAuthor(user);
        comment.setContent(request.getContent().trim());
        QuestionComment saved = commentRepository.save(comment);
        return toCommentResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<CommentResponse> getComments(Long questionId) {
        if (!questionRepository.existsById(questionId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Вопрос не найден");
        }
        return commentRepository.findByQuestionIdOrderByCreatedAtAsc(questionId).stream()
                .map(this::toCommentResponse)
                .collect(Collectors.toList());
    }

    private CommentResponse toCommentResponse(QuestionComment c) {
        CommentResponse r = new CommentResponse();
        r.setId(c.getId());
        r.setContent(c.getContent());
        r.setCreatedAt(c.getCreatedAt());
        if (c.getAuthor() != null) {
            r.setAuthorId(c.getAuthor().getId());
            r.setAuthorName(c.getAuthor().getName() != null ? c.getAuthor().getName() : c.getAuthor().getEmail());
        }
        return r;
    }
}

