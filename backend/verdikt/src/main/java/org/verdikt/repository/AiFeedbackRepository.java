package org.verdikt.repository;

import org.verdikt.entity.AiFeedback;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface AiFeedbackRepository extends JpaRepository<AiFeedback, Long> {

    List<AiFeedback> findByUser_IdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    List<AiFeedback> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @Query("SELECT f FROM AiFeedback f LEFT JOIN FETCH f.user ORDER BY f.createdAt DESC")
    List<AiFeedback> findAllWithUserOrderByCreatedAtDesc(Pageable pageable);

    /** Оценки по сообщениям чата (самые новые первыми — для выбора последней оценки на messageId). */
    @Query("SELECT f FROM AiFeedback f WHERE f.user.id = :userId AND f.chatId = :chatId AND f.messageId IN :messageIds ORDER BY f.createdAt DESC")
    List<AiFeedback> findByUserIdAndChatIdAndMessageIdInOrderByCreatedAtDesc(
            @Param("userId") Long userId,
            @Param("chatId") String chatId,
            @Param("messageIds") Collection<String> messageIds);
}
