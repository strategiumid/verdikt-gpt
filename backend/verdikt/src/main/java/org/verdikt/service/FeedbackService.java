package org.verdikt.service;

import org.verdikt.dto.AnalyticsResponse;
import org.verdikt.dto.AdminFeedbackTotalsResponse;
import org.verdikt.dto.FeedbackRequest;
import org.verdikt.dto.FeedbackResponse;
import org.verdikt.entity.AiFeedback;
import org.verdikt.entity.User;
import org.verdikt.repository.AiFeedbackRepository;
import org.verdikt.repository.UserRepository;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class FeedbackService {

    private final AiFeedbackRepository feedbackRepository;
    private final UserRepository userRepository;

    public FeedbackService(AiFeedbackRepository feedbackRepository, UserRepository userRepository) {
        this.feedbackRepository = feedbackRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public FeedbackResponse save(Long userId, FeedbackRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Пользователь не найден"));
        AiFeedback f = new AiFeedback();
        f.setUser(user);
        Integer ratingVal = request.getRating();
        int r = (ratingVal != null && (ratingVal == 1 || ratingVal == -1)) ? ratingVal : 1;
        f.setRating(r);
        f.setMessageId(request.getMessageId());
        f.setChatId(request.getChatId());
        f.setUserPrompt(request.getUserPrompt());
        f.setAiContent(request.getAiContent());
        f.setTopic(request.getTopic());
        String comment = request.getComment();
        if (comment != null) {
            String t = comment.trim();
            f.setComment(t.isEmpty() ? null : t);
        }
        f = feedbackRepository.save(f);
        return FeedbackResponse.from(f);
    }

    public AnalyticsResponse getAnalytics(Long userId, int recentLimit) {
        List<AiFeedback> all = feedbackRepository.findByUser_IdOrderByCreatedAtDesc(userId, PageRequest.of(0, 10000));
        long total = all.size();
        long helpful = all.stream().filter(f -> f.getRating() > 0).count();
        long notHelpful = all.stream().filter(f -> f.getRating() < 0).count();

        Map<String, AnalyticsResponse.TopicStats> byTopic = new HashMap<>();
        for (AiFeedback f : all) {
            String t = f.getTopic() != null ? f.getTopic() : "other";
            byTopic.computeIfAbsent(t, k -> new AnalyticsResponse.TopicStats());
            if (f.getRating() > 0) {
                byTopic.get(t).setUseful(byTopic.get(t).getUseful() + 1);
            } else {
                byTopic.get(t).setNotUseful(byTopic.get(t).getNotUseful() + 1);
            }
        }

        List<FeedbackResponse> recent = feedbackRepository
                .findByUser_IdOrderByCreatedAtDesc(userId, PageRequest.of(0, recentLimit))
                .stream()
                .map(FeedbackResponse::from)
                .collect(Collectors.toList());

        List<AnalyticsResponse.DayStats> last14Days = new ArrayList<>();
        ZoneId zone = ZoneId.systemDefault();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("EEE, d MMM", java.util.Locale.forLanguageTag("ru"));
        for (int i = 13; i >= 0; i--) {
            LocalDate day = LocalDate.now().minusDays(i);
            long dayStart = day.atStartOfDay(zone).toInstant().toEpochMilli();
            long dayEnd = day.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli();
            long u = all.stream().filter(f -> {
                long ts = f.getCreatedAt().toEpochMilli();
                return ts >= dayStart && ts < dayEnd && f.getRating() > 0;
            }).count();
            long n = all.stream().filter(f -> {
                long ts = f.getCreatedAt().toEpochMilli();
                return ts >= dayStart && ts < dayEnd && f.getRating() < 0;
            }).count();
            AnalyticsResponse.DayStats ds = new AnalyticsResponse.DayStats();
            ds.setLabel(day.format(formatter));
            ds.setUseful(u);
            ds.setNotUseful(n);
            last14Days.add(ds);
        }

        AnalyticsResponse r = new AnalyticsResponse();
        r.setTotal(total);
        r.setHelpful(helpful);
        r.setNotHelpful(notHelpful);
        r.setRatingPercent(total > 0 ? (int) Math.round(100.0 * helpful / total) : null);
        r.setByTopic(byTopic);
        r.setRecent(recent);
        r.setLast14Days(last14Days);
        return r;
    }

    /** Аналитика по всем пользователям для админа (recent — с именем оценщика). */
    public AnalyticsResponse getAllAnalyticsForAdmin(int recentLimit) {
        int safeRecentLimit = Math.max(1, Math.min(recentLimit, 200));
        List<AiFeedback> all = feedbackRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, 10000));
        long total = all.size();
        long helpful = 0;
        long notHelpful = 0;

        Map<String, AnalyticsResponse.TopicStats> byTopic = new HashMap<>();
        ZoneId zone = ZoneId.systemDefault();
        LocalDate today = LocalDate.now(zone);
        LocalDate startDay = today.minusDays(13);
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("EEE, d MMM", java.util.Locale.forLanguageTag("ru"));

        List<AnalyticsResponse.DayStats> last14Days = new ArrayList<>(14);
        Map<LocalDate, AnalyticsResponse.DayStats> dayStatsByDate = new HashMap<>();
        for (int i = 13; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            AnalyticsResponse.DayStats ds = new AnalyticsResponse.DayStats();
            ds.setLabel(day.format(formatter));
            ds.setUseful(0);
            ds.setNotUseful(0);
            last14Days.add(ds);
            dayStatsByDate.put(day, ds);
        }

        for (AiFeedback f : all) {
            int rating = f.getRating();
            if (rating > 0) {
                helpful++;
            } else if (rating < 0) {
                notHelpful++;
            } else {
                continue;
            }

            String topic = (f.getTopic() == null || f.getTopic().isBlank()) ? "other" : f.getTopic().trim();
            AnalyticsResponse.TopicStats topicStats = byTopic.computeIfAbsent(topic, k -> new AnalyticsResponse.TopicStats());
            if (rating > 0) {
                topicStats.setUseful(topicStats.getUseful() + 1);
            } else {
                topicStats.setNotUseful(topicStats.getNotUseful() + 1);
            }

            if (f.getCreatedAt() == null) {
                continue;
            }
            LocalDate feedbackDay = f.getCreatedAt().atZone(zone).toLocalDate();
            if (feedbackDay.isBefore(startDay) || feedbackDay.isAfter(today)) {
                continue;
            }
            AnalyticsResponse.DayStats dayStats = dayStatsByDate.get(feedbackDay);
            if (dayStats == null) {
                continue;
            }
            if (rating > 0) {
                dayStats.setUseful(dayStats.getUseful() + 1);
            } else {
                dayStats.setNotUseful(dayStats.getNotUseful() + 1);
            }
        }

        List<FeedbackResponse> recent = feedbackRepository
                .findAllWithUserOrderByCreatedAtDesc(PageRequest.of(0, safeRecentLimit))
                .stream()
                .map(FeedbackResponse::fromWithUser)
                .collect(Collectors.toList());

        AnalyticsResponse r = new AnalyticsResponse();
        r.setTotal(total);
        r.setHelpful(helpful);
        r.setNotHelpful(notHelpful);
        r.setRatingPercent(total > 0 ? (int) Math.round(100.0 * helpful / total) : null);
        r.setByTopic(byTopic);
        r.setRecent(recent);
        r.setLast14Days(last14Days);
        return r;
    }

    @Transactional(readOnly = true)
    public Page<FeedbackResponse> listFeedbackForAdmin(Pageable pageable,
                                                       String search,
                                                       Long userId,
                                                       Integer rating,
                                                       String topic,
                                                       String chatId,
                                                       String messageId,
                                                       Instant from,
                                                       Instant to) {
        Pageable effectivePageable = withSafeSorting(pageable);
        Specification<AiFeedback> spec = buildAdminFeedbackSpecification(
                search, userId, rating, topic, chatId, messageId, from, to);
        return feedbackRepository.findAll(spec, effectivePageable).map(FeedbackResponse::fromWithUser);
    }

    @Transactional(readOnly = true)
    public AdminFeedbackTotalsResponse getAllAnalyticsForAdminV2() {
        long total = feedbackRepository.countAllFeedback();
        long helpful = feedbackRepository.countHelpfulFeedback();
        long notHelpful = feedbackRepository.countNotHelpfulFeedback();
        return new AdminFeedbackTotalsResponse(total, helpful, notHelpful);
    }

    private Specification<AiFeedback> buildAdminFeedbackSpecification(String search,
                                                                      Long userId,
                                                                      Integer rating,
                                                                      String topic,
                                                                      String chatId,
                                                                      String messageId,
                                                                      Instant from,
                                                                      Instant to) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            Join<AiFeedback, User> userJoin = root.join("user", JoinType.LEFT);

            if (userId != null) {
                predicates.add(cb.equal(userJoin.get("id"), userId));
            }
            if (rating != null) {
                predicates.add(cb.equal(root.get("rating"), rating));
            }
            if (topic != null && !topic.isBlank()) {
                predicates.add(cb.equal(cb.lower(cb.coalesce(root.get("topic"), "")), topic.trim().toLowerCase()));
            }
            if (chatId != null && !chatId.isBlank()) {
                predicates.add(cb.equal(root.get("chatId"), chatId.trim()));
            }
            if (messageId != null && !messageId.isBlank()) {
                predicates.add(cb.equal(root.get("messageId"), messageId.trim()));
            }
            if (from != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), from));
            }
            if (to != null) {
                predicates.add(cb.lessThan(root.get("createdAt"), to));
            }
            if (search != null && !search.isBlank()) {
                String like = "%" + search.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(cb.coalesce(root.get("comment"), "")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("userPrompt"), "")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("aiContent"), "")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("topic"), "")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("chatId"), "")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("messageId"), "")), like),
                        cb.like(cb.lower(cb.coalesce(userJoin.get("name"), "")), like),
                        cb.like(cb.lower(cb.coalesce(userJoin.get("email"), "")), like)
                ));
            }

            return predicates.isEmpty() ? cb.conjunction() : cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private Pageable withSafeSorting(Pageable pageable) {
        if (pageable == null || pageable.getSort().isUnsorted()) {
            int page = pageable != null ? pageable.getPageNumber() : 0;
            int size = pageable != null ? pageable.getPageSize() : 20;
            return PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        }
        return pageable;
    }

}
