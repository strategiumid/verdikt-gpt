package org.verdikt.service;

import org.verdikt.chat.model.ConversationState;
import org.verdikt.chat.model.TopicMemory;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Дедупликация {@link org.verdikt.chat.model.TopicMemory#getFactsFromUser()} (без учёта регистра и лишних пробелов).
 */
public final class TopicMemoryFactsHelper {

    public static final int MAX_FACT_LENGTH = 240;
    public static final int MAX_FACTS = 50;

    private TopicMemoryFactsHelper() {
    }

    public static String normalizeForDedup(String s) {
        if (s == null) {
            return "";
        }
        return s.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }

    public static boolean containsEquivalent(List<String> facts, String candidate) {
        if (facts == null || candidate == null) {
            return false;
        }
        String n = normalizeForDedup(candidate);
        if (n.isEmpty()) {
            return true;
        }
        for (String f : facts) {
            if (normalizeForDedup(f).equals(n)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Добавляет факт, если такого ещё нет и не превышен лимит списка.
     */
    public static void addIfMissing(List<String> facts, String fact, int maxLen, int maxTotal) {
        if (facts == null || fact == null) {
            return;
        }
        String t = fact.trim();
        if (t.isEmpty()) {
            return;
        }
        if (t.length() > maxLen) {
            t = t.substring(0, maxLen);
        }
        if (containsEquivalent(facts, t)) {
            return;
        }
        if (facts.size() >= maxTotal) {
            return;
        }
        facts.add(t);
    }

    /**
     * Убирает дубликаты, порядок — как у первого вхождения.
     */
    public static void dedupePreserveOrder(List<String> facts) {
        if (facts == null || facts.size() <= 1) {
            return;
        }
        Set<String> seen = new LinkedHashSet<>();
        List<String> out = new ArrayList<>();
        for (String f : facts) {
            if (f == null) {
                continue;
            }
            String t = f.trim();
            if (t.isEmpty()) {
                continue;
            }
            if (t.length() > MAX_FACT_LENGTH) {
                t = t.substring(0, MAX_FACT_LENGTH);
            }
            String key = normalizeForDedup(t);
            if (key.isEmpty() || seen.contains(key)) {
                continue;
            }
            seen.add(key);
            out.add(t);
        }
        facts.clear();
        facts.addAll(out);
    }

    public static void dedupeAllTopicFacts(ConversationState state) {
        if (state == null || state.getTopics() == null) {
            return;
        }
        for (TopicMemory t : state.getTopics()) {
            if (t != null && t.getFactsFromUser() != null) {
                dedupePreserveOrder(t.getFactsFromUser());
            }
        }
    }
}
