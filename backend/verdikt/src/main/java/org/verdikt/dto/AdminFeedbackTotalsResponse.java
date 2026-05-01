package org.verdikt.dto;

public class AdminFeedbackTotalsResponse {

    private long total;
    private long helpful;
    private long notHelpful;

    public AdminFeedbackTotalsResponse() {
    }

    public AdminFeedbackTotalsResponse(long total, long helpful, long notHelpful) {
        this.total = total;
        this.helpful = helpful;
        this.notHelpful = notHelpful;
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
}
