package com.agenthub.dto;

import lombok.Data;

@Data
public class AgentIndexRequest {
    private Long agentId;
    private Long versionId;
    private String title;
    private String content;
}