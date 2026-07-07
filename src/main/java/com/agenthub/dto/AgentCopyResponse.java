package com.agenthub.dto;

import lombok.Data;

@Data
public class AgentCopyResponse {
    private Long agentId;
    private Long versionId;
    private String promptTemplate;
    private String inputSchema;
    private String workflowConfig;
    private String modelSuggestion;
}