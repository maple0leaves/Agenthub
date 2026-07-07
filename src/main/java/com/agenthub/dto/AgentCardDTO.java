package com.agenthub.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AgentCardDTO {
    private Long id;
    private Long userId;
    private Long categoryId;
    private String categoryName;
    private String name;
    private String description;
    private String avatar;
    private String type;
    private String visibility;
    private Integer starCount;
    private Integer forkCount;
    private Integer copyCount;
    private Integer viewCount;
    private Integer versionCount;
    private Integer score;
    private Long parentAgentId;
    private String authorName;
    private String authorIcon;
    private Boolean isStar;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}