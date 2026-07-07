package com.agenthub.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("tb_agent_search_doc")
public class AgentSearchDoc implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId("agent_id")
    private Long agentId;
    private Long versionId;
    private String title;
    private String content;
    private Integer embeddingStatus;
    private LocalDateTime updateTime;
}