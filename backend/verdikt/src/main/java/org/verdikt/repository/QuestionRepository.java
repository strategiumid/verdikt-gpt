package org.verdikt.repository;

import org.verdikt.entity.Question;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface QuestionRepository extends JpaRepository<Question, Long> {

    List<Question> findTop50ByOrderByCreatedAtDesc();
}

