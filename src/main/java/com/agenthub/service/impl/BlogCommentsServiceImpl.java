package com.agenthub.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.agenthub.dto.Result;
import com.agenthub.dto.UserDTO;
import com.agenthub.entity.BlogCommentLike;
import com.agenthub.entity.BlogComments;
import com.agenthub.entity.User;
import com.agenthub.mapper.BlogCommentLikeMapper;
import com.agenthub.mapper.BlogCommentsMapper;
import com.agenthub.service.IBlogCommentsService;
import com.agenthub.service.IUserService;
import com.agenthub.utils.UserHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.Resource;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class BlogCommentsServiceImpl extends ServiceImpl<BlogCommentsMapper, BlogComments> implements IBlogCommentsService {

    @Resource
    private IUserService userService;
    @Resource
    private BlogCommentLikeMapper likeMapper;

    @Override
    public Result listByBlogId(Long blogId) {
        List<BlogComments> comments = lambdaQuery()
                .eq(BlogComments::getBlogId, blogId)
                .orderByAsc(BlogComments::getId)
                .list();

        if (!comments.isEmpty()) {
            Set<Long> userIds = comments.stream().map(BlogComments::getUserId).collect(Collectors.toSet());
            Map<Long, User> userMap = userService.listByIds(userIds).stream()
                    .collect(Collectors.toMap(User::getId, u -> u));

            UserDTO currentUser = UserHolder.getUser();
            final Set<Long> likedIds;
            if (currentUser != null) {
                likedIds = likeMapper.selectList(
                        new LambdaQueryWrapper<BlogCommentLike>()
                                .eq(BlogCommentLike::getUserId, currentUser.getId())
                                .in(BlogCommentLike::getCommentId, comments.stream().map(BlogComments::getId).collect(Collectors.toList()))
                ).stream().map(BlogCommentLike::getCommentId).collect(Collectors.toSet());
            } else {
                likedIds = Collections.emptySet();
            }

            List<Map<String, Object>> result = comments.stream().map(c -> {
                Map<String, Object> m = new HashMap<>();
                m.put("id", c.getId());
                m.put("blogId", c.getBlogId());
                m.put("parentId", c.getParentId());
                m.put("content", c.getContent());
                m.put("liked", c.getLiked());
                m.put("createTime", c.getCreateTime());
                m.put("userId", c.getUserId());
                m.put("isLiked", likedIds.contains(c.getId()));
                User u = userMap.get(c.getUserId());
                m.put("userName", u != null ? u.getNickName() : "匿名");
                m.put("userIcon", u != null ? u.getIcon() : null);
                return m;
            }).collect(Collectors.toList());
            return Result.ok(result);
        }
        return Result.ok(comments);
    }

    @Override
    public Result addComment(Long blogId, String content) {
        UserDTO user = UserHolder.getUser();
        if (user == null) return Result.fail("请先登录");
        if (content == null || content.trim().isEmpty()) return Result.fail("内容不能为空");

        BlogComments comment = new BlogComments();
        comment.setBlogId(blogId);
        comment.setParentId(0L);
        comment.setAnswerId(0L);
        comment.setUserId(user.getId());
        comment.setContent(content.trim());
        comment.setLiked(0);
        comment.setStatus(false);
        save(comment);

        Map<String, Object> result = new HashMap<>();
        result.put("id", comment.getId());
        result.put("blogId", comment.getBlogId());
        result.put("content", comment.getContent());
        result.put("liked", 0);
        result.put("createTime", comment.getCreateTime());
        result.put("userId", user.getId());
        result.put("userName", user.getNickName());
        result.put("userIcon", user.getIcon());
        return Result.ok(result);
    }

    @Override
    @Transactional
    public Result deleteComment(Long commentId) {
        UserDTO user = UserHolder.getUser();
        if (user == null) return Result.fail("请先登录");
        BlogComments comment = getById(commentId);
        if (comment == null) return Result.fail("评论不存在");
        if (!comment.getUserId().equals(user.getId())) return Result.fail("只能删除自己的评论");
        likeMapper.delete(new LambdaQueryWrapper<BlogCommentLike>().eq(BlogCommentLike::getCommentId, commentId));
        removeById(commentId);
        return Result.ok();
    }

    @Override
    @Transactional
    public Result likeComment(Long commentId) {
        UserDTO user = UserHolder.getUser();
        if (user == null) return Result.fail("请先登录");
        BlogComments comment = getById(commentId);
        if (comment == null) return Result.fail("评论不存在");

        BlogCommentLike existing = likeMapper.selectOne(
                new LambdaQueryWrapper<BlogCommentLike>()
                        .eq(BlogCommentLike::getCommentId, commentId)
                        .eq(BlogCommentLike::getUserId, user.getId()));
        if (existing != null) {
            likeMapper.deleteById(existing.getId());
            lambdaUpdate().eq(BlogComments::getId, commentId).setSql("liked = liked - 1").update();
            return Result.ok(false);
        } else {
            BlogCommentLike like = new BlogCommentLike();
            like.setCommentId(commentId);
            like.setUserId(user.getId());
            likeMapper.insert(like);
            lambdaUpdate().eq(BlogComments::getId, commentId).setSql("liked = liked + 1").update();
            return Result.ok(true);
        }
    }
}
