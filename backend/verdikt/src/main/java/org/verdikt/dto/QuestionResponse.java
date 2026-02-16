package org.verdikt.dto;

import org.verdikt.entity.Question;

import java.time.Instant;

/**
 * Ответ с данными вопроса (включая счётчики лайков/дизлайков/комментариев).
 */
public class QuestionResponse {

    private Long id;
    private String content;
    private Instant createdAt;
    private Long authorId;
    private String authorName;
    private String authorEmail;
    private long likesCount;
    private long dislikesCount;
    private long commentsCount;
    private Boolean isLiked;
    private Boolean isDisliked;
    private Boolean resolved;

    public static QuestionResponse from(Question question) {
        QuestionResponse r = new QuestionResponse();
        r.setId(question.getId());
        r.setContent(question.getContent());
        r.setCreatedAt(question.getCreatedAt());
        if (question.getAuthor() != null) {
            r.setAuthorId(question.getAuthor().getId());
            r.setAuthorEmail(question.getAuthor().getEmail());
            r.setAuthorName(question.getAuthor().getName());
        }
        r.setResolved(question.isResolved());
        return r;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Long getAuthorId() {
        return authorId;
    }

    public void setAuthorId(Long authorId) {
        this.authorId = authorId;
    }

    public String getAuthorName() {
        return authorName;
    }

    public void setAuthorName(String authorName) {
        this.authorName = authorName;
    }

    public String getAuthorEmail() {
        return authorEmail;
    }

    public void setAuthorEmail(String authorEmail) {
        this.authorEmail = authorEmail;
    }

    public long getLikesCount() {
        return likesCount;
    }

    public void setLikesCount(long likesCount) {
        this.likesCount = likesCount;
    }

    public long getDislikesCount() {
        return dislikesCount;
    }

    public void setDislikesCount(long dislikesCount) {
        this.dislikesCount = dislikesCount;
    }

    public long getCommentsCount() {
        return commentsCount;
    }

    public void setCommentsCount(long commentsCount) {
        this.commentsCount = commentsCount;
    }

    public Boolean getIsLiked() {
        return isLiked;
    }

    public void setIsLiked(Boolean isLiked) {
        this.isLiked = isLiked;
    }

    public Boolean getIsDisliked() {
        return isDisliked;
    }

    public void setIsDisliked(Boolean isDisliked) {
        this.isDisliked = isDisliked;
    }

    public Boolean getResolved() {
        return resolved;
    }

    public void setResolved(Boolean resolved) {
        this.resolved = resolved;
    }
}

