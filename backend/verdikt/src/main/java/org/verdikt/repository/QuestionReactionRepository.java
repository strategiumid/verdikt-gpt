package org.verdikt.repository;

import org.verdikt.entity.QuestionReaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface QuestionReactionRepository extends JpaRepository<QuestionReaction, Long> {

    long countByQuestionIdAndType(Long questionId, QuestionReaction.Type type);

    Optional<QuestionReaction> findByQuestionIdAndUserId(Long questionId, Long userId);

    void deleteByQuestionIdAndUserId(Long questionId, Long userId);
}

