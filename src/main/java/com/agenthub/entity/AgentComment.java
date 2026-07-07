package com.agenthub.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;

@Data
@TableName("tb_agent_comment")
public class AgentComment implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;
    private Long agentId;
    private Long parentId;
    private Long userId;
    private String content;
    private Integer likes;
    private Integer updated;
    private LocalDateTime createTime;

    @TableField(exist = false)
    private String userName;
    @TableField(exist = false)
    private String userIcon;
    @TableField(exist = false)
    private Boolean isLiked;
    @TableField(exist = false)
    private List<AgentComment> replies;
}
