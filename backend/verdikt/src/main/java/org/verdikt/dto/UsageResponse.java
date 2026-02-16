package org.verdikt.dto;

/**
 * Ответ GET /api/users/me/usage и POST /api/users/me/usage/increment —
 * использование лимита запросов к AI за текущий период (месяц).
 */
public class UsageResponse {

    /** Использовано запросов в текущем периоде. */
    private int used;
    /** Лимит запросов по подписке. */
    private int limit;
    /** Начало периода (год-месяц, например "2026-02"). */
    private String periodStart;

    public int getUsed() {
        return used;
    }

    public void setUsed(int used) {
        this.used = used;
    }

    public int getLimit() {
        return limit;
    }

    public void setLimit(int limit) {
        this.limit = limit;
    }

    public String getPeriodStart() {
        return periodStart;
    }

    public void setPeriodStart(String periodStart) {
        this.periodStart = periodStart;
    }
}
