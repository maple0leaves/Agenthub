package com.agenthub.dto;

import lombok.Data;

@Data
public class AgentVersionRequest {
    private String version;
    private String promptTemplate;
    private String inputSchema;
    private String workflowConfig;
    private String modelSuggestion;
    private String changelog;
    private String references;
    private String scripts;
    private String assets;
}