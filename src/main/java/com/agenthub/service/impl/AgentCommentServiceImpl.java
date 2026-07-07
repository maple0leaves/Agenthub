package com.agenthub.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.agenthub.dto.Result;
import com.agenthub.dto.UserDTO;
import com.agenthub.entity.AgentComment;
import com.agenthub.entity.AgentCommentLike;
import com.agenthub.entity.User;
import com.agenthub.mapper.AgentCommentLikeMapper;
import com.agenthub.mapper.AgentCommentMapper;
import com.agenthub.service.IAgentCommentService;
import com.agenthub.service.IUserService;
import com.agenthub.utils.UserHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.Resource;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AgentCommentServiceImpl extends ServiceImpl<AgentCommentMapper, AgentComment> implements IAgentCommentService {

    @Resource
    private IUserService userService;
    @Resource
    private AgentCommentLikeMapper likeMapper;

    @Override
    public Result listByAgentId(Long agentId) {
        List<AgentComment> all = lambdaQuery()
                .eq(AgentComment::getAgentId, agentId)
                .orderByAsc(AgentComment::getId)
                .list();

        // Fill user info
        if (!all.isEmpty()) {
            Set<Long> userIds = all.stream().map(AgentComment::getUserId).collect(Collectors.toSet());
            Map<Long, User> userMap = userService.listByIds(userIds).stream()
                    .collect(Collectors.toMap(User::getId, u -> u));

            UserDTO currentUser = UserHolder.getUser();
            Set<Long> likedIds = Collections.emptySet();
            if (currentUser != null) {
                likedIds = likeMapper.selectList(
                        new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<AgentCommentLike>()
                                .eq(AgentCommentLike::getUserId, currentUser.getId())
                                .in(AgentCommentLike::getCommentId, all.stream().map(AgentComment::getId).collect(Collectors.toList()))
                ).stream().map(AgentCommentLike::getCommentId).collect(Collectors.toSet());
            }

            for (AgentComment c : all) {
                User u = userMap.get(c.getUserId());
                if (u != null) {
                    c.setUserName(u.getNickName());
                    c.setUserIcon(u.getIcon());
                }
                c.setIsLiked(likedIds.contains(c.getId()));
            }
        }

        // Build a complete comment tree supporting arbitrary depth.
        Map<Long, AgentComment> commentMap = new HashMap<>(all.size());
        for (AgentComment comment : all) {
            comment.setReplies(new ArrayList<>());
            commentMap.put(comment.getId(), comment);
        }

        List<AgentComment> top = new ArrayList<>();
        for (AgentComment comment : all) {
            Long parentId = comment.getParentId();
            if (parentId == null) {
                top.add(comment);
                continue;
            }
            AgentComment parent = commentMap.get(parentId);
            if (parent == null) {
                // Parent may be deleted; keep this node visible.
                top.add(comment);
                continue;
            }
            parent.getReplies().add(comment);
        }

        sortCommentTree(top);
        return Result.ok(top);
    }

    @Override
    public Result addComment(Long agentId, Long parentId, String content) {
        UserDTO user = UserHolder.getUser();
        if (user == null) return Result.fail("请先登录");
        if (content == null || content.trim().isEmpty()) return Result.fail("内容不能为空");

        AgentComment comment = new AgentComment();
        comment.setAgentId(agentId);
        comment.setParentId(parentId);
        comment.setUserId(user.getId());
        comment.setContent(content.trim());
        comment.setLikes(0);
        comment.setUpdated(0);
        save(comment);

        // 从 DB 拉取最新用户信息，确保头像/昵称是最新的
        User dbUser = userService.getById(user.getId());
        comment.setUserName(dbUser != null ? dbUser.getNickName() : user.getNickName());
        comment.setUserIcon(dbUser != null ? dbUser.getIcon() : user.getIcon());
        comment.setIsLiked(false);
        comment.setReplies(java.util.Collections.emptyList());

        return Result.ok(comment);
    }

    private void sortCommentTree(List<AgentComment> comments) {
        comments.sort(Comparator.comparing(AgentComment::getId));
        for (AgentComment comment : comments) {
            if (comment.getReplies() == null || comment.getReplies().isEmpty()) {
                continue;
            }
            sortCommentTree(comment.getReplies());
        }
    }

    @Override
    @Transactional
    public Result editComment(Long commentId, String content) {
        UserDTO user = UserHolder.getUser();
        if (user == null) return Result.fail("请先登录");
        AgentComment comment = getById(commentId);
        if (comment == null) return Result.fail("评论不存在");
        if (!comment.getUserId().equals(user.getId())) return Result.fail("只能编辑自己的评论");
        if (content == null || content.trim().isEmpty()) return Result.fail("内容不能为空");

        comment.setContent(content.trim());
        comment.setUpdated(1);
        updateById(comment);
        return Result.ok();
    }

    @Override
    @Transactional
    public Result deleteComment(Long commentId) {
        UserDTO user = UserHolder.getUser();
        if (user == null) return Result.fail("请先登录");
        AgentComment comment = getById(commentId);
        if (comment == null) return Result.fail("评论不存在");
        if (!comment.getUserId().equals(user.getId())) return Result.fail("只能删除自己的评论");

        // Delete replies and likes
        lambdaUpdate().eq(AgentComment::getParentId, commentId).remove();
        likeMapper.delete(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<AgentCommentLike>()
                .eq(AgentCommentLike::getCommentId, commentId));
        removeById(commentId);
        return Result.ok();
    }

    @Override
    @Transactional
    public Result likeComment(Long commentId) {
        UserDTO user = UserHolder.getUser();
        if (user == null) return Result.fail("请先登录");

        AgentComment comment = getById(commentId);
        if (comment == null) return Result.fail("评论不存在");

        AgentCommentLike existing = likeMapper.selectOne(
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<AgentCommentLike>()
                        .eq(AgentCommentLike::getCommentId, commentId)
                        .eq(AgentCommentLike::getUserId, user.getId()));

        if (existing != null) {
            // Unlike
            likeMapper.deleteById(existing.getId());
            lambdaUpdate().eq(AgentComment::getId, commentId).setSql("likes = likes - 1").update();
            return Result.ok(false);
        } else {
            // Like
            AgentCommentLike like = new AgentCommentLike();
            like.setCommentId(commentId);
            like.setUserId(user.getId());
            likeMapper.insert(like);
            lambdaUpdate().eq(AgentComment::getId, commentId).setSql("likes = likes + 1").update();
            return Result.ok(true);
        }
    }
}
