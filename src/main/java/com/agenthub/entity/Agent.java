package com.agenthub.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("tb_agent")
public class Agent implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;
    private Long userId;
    private Long categoryId;
    private String name;
    private String description;
    private String avatar;
    private String type;
    private String visibility;
    private Integer status;
    private Integer starCount;
    private Integer forkCount;
    private Integer copyCount;
    private Integer viewCount;
    private Integer versionCount;
    private Integer score;
    private Long parentAgentId;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    @TableField(exist = false)
    private String authorName;
    @TableField(exist = false)
    private String authorIcon;
    @TableField(exist = false)
    private String categoryName;
    @TableField(exist = false)
    private Boolean isStar;
}