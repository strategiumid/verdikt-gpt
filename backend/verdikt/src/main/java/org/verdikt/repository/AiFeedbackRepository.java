package org.verdikt.repository;

import org.verdikt.entity.AiFeedback;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface AiFeedbackRepository extends JpaRepository<AiFeedback, Long> {

    List<AiFeedback> findByUser_IdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    List<AiFeedback> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @Query("SELECT f FROM AiFeedback f LEFT JOIN FETCH f.user ORDER BY f.createdAt DESC")
    List<AiFeedback> findAllWithUserOrderByCreatedAtDesc(Pageable pageable);
}
