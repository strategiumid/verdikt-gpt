package org.verdikt.dto;

import java.util.List;
import java.util.Map;

/**
 * Ответ GET /api/users/me/feedback/analytics — сводка по оценкам ответов ИИ.
 */
public class AnalyticsResponse {

    private long total;
    private long helpful;
    private long notHelpful;
    /** Доля полезных в процентах (0–100), или null если оценок нет */
    private Integer ratingPercent;
    /** По темам: тема -> { useful, notUseful } */
    private Map<String, TopicStats> byTopic;
    /** Последние оценки (для активности) */
    private List<FeedbackResponse> recent;
    /** За последние 14 дней: для графика (label, useful, notUseful) */
    private List<DayStats> last14Days;

    public static class DayStats {
        private String label;
        private long useful;
        private long notUseful;

        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }
        public long getUseful() { return useful; }
        public void setUseful(long useful) { this.useful = useful; }
        public long getNotUseful() { return notUseful; }
        public void setNotUseful(long notUseful) { this.notUseful = notUseful; }
    }

    public static class TopicStats {
        private long useful;
        private long notUseful;

        public long getUseful() {
            return useful;
        }

        public void setUseful(long useful) {
            this.useful = useful;
        }

        public long getNotUseful() {
            return notUseful;
        }

        public void setNotUseful(long notUseful) {
            this.notUseful = notUseful;
        }
    }

    public long getTotal() {
        return total;
    }

    public void setTotal(long total) {
        this.total = total;
    }

    public long getHelpful() {
        return helpful;
    }

    public void setHelpful(long helpful) {
        this.helpful = helpful;
    }

    public long getNotHelpful() {
        return notHelpful;
    }

    public void setNotHelpful(long notHelpful) {
        this.notHelpful = notHelpful;
    }

    public Integer getRatingPercent() {
        return ratingPercent;
    }

    public void setRatingPercent(Integer ratingPercent) {
        this.ratingPercent = ratingPercent;
    }

    public Map<String, TopicStats> getByTopic() {
        return byTopic;
    }

    public void setByTopic(Map<String, TopicStats> byTopic) {
        this.byTopic = byTopic;
    }

    public List<FeedbackResponse> getRecent() {
        return recent;
    }

    public void setRecent(List<FeedbackResponse> recent) {
        this.recent = recent;
    }

    public List<DayStats> getLast14Days() {
        return last14Days;
    }

    public void setLast14Days(List<DayStats> last14Days) {
        this.last14Days = last14Days;
    }
}
