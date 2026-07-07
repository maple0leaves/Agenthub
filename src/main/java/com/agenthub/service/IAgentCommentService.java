package com.agenthub.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.agenthub.dto.Result;
import com.agenthub.entity.AgentComment;

public interface IAgentCommentService extends IService<AgentComment> {
    Result listByAgentId(Long agentId);
    Result addComment(Long agentId, Long parentId, String content);
    Result editComment(Long commentId, String content);
    Result deleteComment(Long commentId);
    Result likeComment(Long commentId);
}
