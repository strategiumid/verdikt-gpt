package org.verdikt.service;

import org.verdikt.dto.AnalyticsResponse;
import org.verdikt.dto.FeedbackRequest;
import org.verdikt.dto.FeedbackResponse;
import org.verdikt.entity.AiFeedback;
import org.verdikt.entity.User;
import org.verdikt.repository.AiFeedbackRepository;
import org.verdikt.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

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
        List<AiFeedback> all = feedbackRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, 10000));
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
                .findAllWithUserOrderByCreatedAtDesc(PageRequest.of(0, recentLimit))
                .stream()
                .map(FeedbackResponse::fromWithUser)
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
}
