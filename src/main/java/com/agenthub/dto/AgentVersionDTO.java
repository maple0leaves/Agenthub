package com.agenthub.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AgentVersionDTO {
    private Long id;
    private Long agentId;
    private String version;
    private String promptTemplate;
    private String inputSchema;
    private String workflowConfig;
    private String modelSuggestion;
    private String changelog;
    private String references;
    private String scripts;
    private String assets;
    private LocalDateTime createTime;
}