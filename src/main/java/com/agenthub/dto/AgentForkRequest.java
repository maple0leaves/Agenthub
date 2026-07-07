package com.agenthub.dto;

import lombok.Data;

@Data
public class AgentForkRequest {
    private Long categoryId;
    private String name;
    private String description;
    private String avatar;
}