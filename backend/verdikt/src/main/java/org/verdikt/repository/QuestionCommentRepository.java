package org.verdikt.repository;

import org.verdikt.entity.QuestionComment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface QuestionCommentRepository extends JpaRepository<QuestionComment, Long> {

    long countByQuestionId(Long questionId);

    List<QuestionComment> findByQuestionIdOrderByCreatedAtAsc(Long questionId);

    void deleteByQuestionId(Long questionId);
}

