package com.agenthub.dto;

import lombok.Data;

@Data
public class AgentCreateRequest {
    private Long categoryId;
    private String name;
    private String description;
    private String avatar;
    private String type;
    private String visibility;
    private String promptTemplate;
    private String inputSchema;
    private String workflowConfig;
    private String modelSuggestion;
    private String changelog;
    private String references;
    private String scripts;
    private String assets;
}