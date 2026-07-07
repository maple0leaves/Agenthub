package com.agenthub.dto;

import lombok.Data;

@Data
public class AgentSemanticSearchRequest {
    private String query;
    private Integer limit;
    private Integer current;
}