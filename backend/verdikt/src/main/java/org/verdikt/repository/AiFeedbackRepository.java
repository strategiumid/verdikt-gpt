package org.verdikt.repository;

import org.verdikt.entity.AiFeedback;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.lang.Nullable;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

public interface AiFeedbackRepository extends JpaRepository<AiFeedback, Long>, JpaSpecificationExecutor<AiFeedback> {

    @Override
    @EntityGraph(attributePaths = {"user"})
    Page<AiFeedback> findAll(@Nullable Specification<AiFeedback> spec, Pageable pageable);

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

    @Query("SELECT COUNT(f) FROM AiFeedback f")
    long countAllFeedback();

    @Query("SELECT COUNT(f) FROM AiFeedback f WHERE f.rating > 0")
    long countHelpfulFeedback();

    @Query("SELECT COUNT(f) FROM AiFeedback f WHERE f.rating < 0")
    long countNotHelpfulFeedback();

    @Query("""
            SELECT COALESCE(f.topic, 'other'),
                   SUM(CASE WHEN f.rating > 0 THEN 1 ELSE 0 END),
                   SUM(CASE WHEN f.rating < 0 THEN 1 ELSE 0 END)
            FROM AiFeedback f
            GROUP BY COALESCE(f.topic, 'other')
            """)
    List<Object[]> aggregateByTopic();

    @Query("""
            SELECT FUNCTION('DATE', f.createdAt),
                   SUM(CASE WHEN f.rating > 0 THEN 1 ELSE 0 END),
                   SUM(CASE WHEN f.rating < 0 THEN 1 ELSE 0 END)
            FROM AiFeedback f
            WHERE f.createdAt >= :fromInclusive AND f.createdAt < :toExclusive
            GROUP BY FUNCTION('DATE', f.createdAt)
            """)
    List<Object[]> aggregateByDay(@Param("fromInclusive") Instant fromInclusive,
                                  @Param("toExclusive") Instant toExclusive);
}
