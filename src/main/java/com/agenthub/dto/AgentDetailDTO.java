package com.agenthub.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class AgentDetailDTO {
    private AgentCardDTO agent;
    private AgentVersionDTO latestVersion;
    private List<AgentVersionDTO> versions;
    private LocalDateTime viewTime;
}