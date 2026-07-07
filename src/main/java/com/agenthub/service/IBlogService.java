package com.agenthub.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.agenthub.dto.Result;
import com.agenthub.entity.Blog;

/**
 * <p>
 *  服务类
 * </p>
 *
 */
public interface IBlogService extends IService<Blog> {

    /**
     * 查询热门博客
     *
     * @param current 当前
     * @return {@link Result}
     */
    Result queryHotBlog(Integer current);

    /**
     * 通过id查询博客
     *
     * @param id id
     * @return {@link Result}
     */
    Result queryBlogById(Long id);

    /**
     * 点赞博客
     *
     * @param id id
     * @return {@link Result}
     */
    Result likeBlog(Long id);

    /**
     * 查询博客点赞排行榜
     *
     * @param id id
     * @return {@link Result}
     */
    Result queryBlogLikesById(Long id);

    /**
     * 保存博客
     *
     * @param blog 博客
     * @return {@link Result}
     */
    Result saveBlog(Blog blog);

    /**
     * 查询博客遵循
     *
     * @param max    马克斯
     * @param offset 抵消
     * @return {@link Result}
     */
    Result queryBlogOfFollow(Long max, Integer offset);

    /**
     * 填充博客的用户信息（昵称、头像）
     *
     * @param blog 博客实体
     */
    void populateBlogUser(Blog blog);
}
