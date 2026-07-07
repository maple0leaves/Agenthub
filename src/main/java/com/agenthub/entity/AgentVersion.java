package com.agenthub.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("tb_agent_version")
public class AgentVersion implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;
    private Long agentId;
    private String version;
    private String promptTemplate;
    private String inputSchema;
    private String workflowConfig;
    private String modelSuggestion;
    private String changelog;
    @TableField("`references`")
    private String references;
    private String scripts;
    private String assets;
    private LocalDateTime createTime;
}