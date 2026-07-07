package com.agenthub.dto;

import lombok.Data;

@Data
public class AgentUpdateRequest {
    private Long categoryId;
    private String name;
    private String description;
    private String avatar;
    private String type;
    private String visibility;
    private Integer status;
}