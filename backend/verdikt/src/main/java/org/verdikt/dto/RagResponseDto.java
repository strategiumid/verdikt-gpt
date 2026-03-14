package org.verdikt.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.ArrayList;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class RagResponseDto {

    private List<RagItemDto> top = new ArrayList<>();

    public List<RagItemDto> getTop() {
        return top;
    }

    public void setTop(List<RagItemDto> top) {
        this.top = top;
    }
}

