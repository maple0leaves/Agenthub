package com.agenthub.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.agenthub.dto.Result;
import com.agenthub.entity.BlogComments;

public interface IBlogCommentsService extends IService<BlogComments> {
    Result listByBlogId(Long blogId);
    Result addComment(Long blogId, String content);
    Result deleteComment(Long commentId);
    Result likeComment(Long commentId);
}
