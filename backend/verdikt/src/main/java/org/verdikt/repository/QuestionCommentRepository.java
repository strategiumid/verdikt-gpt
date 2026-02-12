package org.verdikt.repository;

import org.verdikt.entity.QuestionComment;
import org.springframework.data.jpa.repository.JpaRepository;

public interface QuestionCommentRepository extends JpaRepository<QuestionComment, Long> {

    long countByQuestionId(Long questionId);
}

