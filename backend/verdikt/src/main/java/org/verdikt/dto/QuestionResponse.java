package org.verdikt.dto;

import org.verdikt.entity.Question;

import java.time.Instant;

/**
 * Ответ с данными вопроса.
 */
public class QuestionResponse {

    private Long id;
    private String content;
    private Instant createdAt;
    private Long authorId;
    private String authorName;
    private String authorEmail;
    private int likesCount;
    private int dislikesCount;
    private int commentsCount;
    /** Поставил ли текущий пользователь лайк этому вопросу */
    private boolean likedByCurrentUser;
    /** Поставил ли текущий пользователь дизлайк этому вопросу */
    private boolean dislikedByCurrentUser;

    public static QuestionResponse from(Question question) {
        QuestionResponse r = new QuestionResponse();
        r.setId(question.getId());
        r.setContent(question.getContent());
        r.setCreatedAt(question.getCreatedAt());
        r.setLikesCount(question.getLikesCount());
        r.setDislikesCount(question.getDislikesCount());
        r.setCommentsCount(question.getCommentsCount());
        if (question.getAuthor() != null) {
            r.setAuthorId(question.getAuthor().getId());
            r.setAuthorEmail(question.getAuthor().getEmail());
            r.setAuthorName(question.getAuthor().getName());
        }
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

    public int getLikesCount() {
        return likesCount;
    }

    public void setLikesCount(int likesCount) {
        this.likesCount = likesCount;
    }

    public int getDislikesCount() {
        return dislikesCount;
    }

    public void setDislikesCount(int dislikesCount) {
        this.dislikesCount = dislikesCount;
    }

    public int getCommentsCount() {
        return commentsCount;
    }

    public void setCommentsCount(int commentsCount) {
        this.commentsCount = commentsCount;
    }

    public boolean isLikedByCurrentUser() {
        return likedByCurrentUser;
    }

    public void setLikedByCurrentUser(boolean likedByCurrentUser) {
        this.likedByCurrentUser = likedByCurrentUser;
    }

    public boolean isDislikedByCurrentUser() {
        return dislikedByCurrentUser;
    }

    public void setDislikedByCurrentUser(boolean dislikedByCurrentUser) {
        this.dislikedByCurrentUser = dislikedByCurrentUser;
    }
}

