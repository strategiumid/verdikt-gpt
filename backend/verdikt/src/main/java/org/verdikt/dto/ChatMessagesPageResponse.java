package org.verdikt.dto;

import java.util.List;

/**
 * Ответ с пагинированным списком сообщений чата.
 */
public class ChatMessagesPageResponse {

    private List<ChatMessageDto> content;
    private long totalElements;
    private int totalPages;
    private int size;
    private int number;

    public ChatMessagesPageResponse() {
    }

    public ChatMessagesPageResponse(List<ChatMessageDto> content, long totalElements, int totalPages, int size, int number) {
        this.content = content;
        this.totalElements = totalElements;
        this.totalPages = totalPages;
        this.size = size;
        this.number = number;
    }

    public List<ChatMessageDto> getContent() {
        return content;
    }

    public void setContent(List<ChatMessageDto> content) {
        this.content = content;
    }

    public long getTotalElements() {
        return totalElements;
    }

    public void setTotalElements(long totalElements) {
        this.totalElements = totalElements;
    }

    public int getTotalPages() {
        return totalPages;
    }

    public void setTotalPages(int totalPages) {
        this.totalPages = totalPages;
    }

    public int getSize() {
        return size;
    }

    public void setSize(int size) {
        this.size = size;
    }

    public int getNumber() {
        return number;
    }

    public void setNumber(int number) {
        this.number = number;
    }
}
