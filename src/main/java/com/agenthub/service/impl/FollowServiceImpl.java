package com.agenthub.service.impl;

import cn.hutool.core.bean.BeanUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.agenthub.dto.Result;
import com.agenthub.dto.UserDTO;
import com.agenthub.entity.Agent;
import com.agenthub.entity.Follow;
import com.agenthub.entity.User;
import com.agenthub.mapper.AgentMapper;
import com.agenthub.mapper.FollowMapper;
import com.agenthub.service.IFollowService;
import com.agenthub.service.IUserService;
import com.agenthub.utils.RedisConstants;
import com.agenthub.utils.SystemConstants;
import com.agenthub.utils.UserHolder;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * <p>
 *  服务实现类
 * </p>
 *
 */
@Service
public class FollowServiceImpl extends ServiceImpl<FollowMapper, Follow> implements IFollowService {
    private static final int STATUS_PUBLIC = 1;

    @Resource
    private StringRedisTemplate stringRedisTemplate;
    @Resource
    private IUserService userService;
    @Resource
    private AgentMapper agentMapper;

    @Override
    public Result follow(Long followUserId, Boolean isFollow) {
        //获取登陆用户
        Long id = UserHolder.getUser().getId();
        if (followUserId == null) {
            return Result.fail("关注目标不能为空");
        }
        if (id.equals(followUserId)) {
            return Result.fail("不能关注自己");
        }
        String followKey = "follows:" + id;
        String feedKey = RedisConstants.AGENT_FEED_KEY + id;
        //判断是关注还是取关
        if (isFollow) {
            //关注 新增数据
            Follow follow=new Follow();
            follow.setFollowUserId(followUserId);
            follow.setUserId(id);
            boolean isSuccess = save(follow);
            if (isSuccess){
                stringRedisTemplate.opsForSet().add(followKey,followUserId.toString());
                // 回填已关注作者的历史公开模板，避免“刚关注但关注页空白”
                List<Agent> recentAgents = agentMapper.selectList(new LambdaQueryWrapper<Agent>()
                        .eq(Agent::getUserId, followUserId)
                        .eq(Agent::getStatus, STATUS_PUBLIC)
                        .orderByDesc(Agent::getUpdateTime)
                        .last("limit " + SystemConstants.MAX_PAGE_SIZE));
                for (Agent agent : recentAgents) {
                    LocalDateTime time = agent.getUpdateTime() != null ? agent.getUpdateTime() : agent.getCreateTime();
                    long score = time == null ? System.currentTimeMillis() : time.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
                    stringRedisTemplate.opsForZSet().add(feedKey, agent.getId().toString(), score);
                }
            }
        }else {
            //取关 删除
            boolean isSuccess = remove(new LambdaQueryWrapper<Follow>()
                    .eq(Follow::getUserId, id)
                    .eq(Follow::getFollowUserId, followUserId)
            );
            if (isSuccess) {
                stringRedisTemplate.opsForSet().remove(followKey, followUserId.toString());
                // 取关后将该作者的模板从关注流移除
                List<Agent> followAgents = agentMapper.selectList(new LambdaQueryWrapper<Agent>()
                        .select(Agent::getId)
                        .eq(Agent::getUserId, followUserId)
                        .eq(Agent::getStatus, STATUS_PUBLIC));
                if (!followAgents.isEmpty()) {
                    String[] agentIds = followAgents.stream().map(agent -> agent.getId().toString()).toArray(String[]::new);
                    stringRedisTemplate.opsForZSet().remove(feedKey, (Object[]) agentIds);
                }
            }
        }
        return Result.ok();
    }

    @Override
    public Result isFollow(Long followUserId) {
        //获取登陆用户
        Long id = UserHolder.getUser().getId();
        if (followUserId == null || id.equals(followUserId)) {
            return Result.ok(false);
        }
        //查询是否关注
        Long count = lambdaQuery()
                .eq(Follow::getUserId, id)
                .eq(Follow::getFollowUserId, followUserId)
                .count();
        return Result.ok(count>0);
    }

    @Override
    public Result followCommons(Long id) {
        //获取登陆用户
        Long userId = UserHolder.getUser().getId();
        String key="follows:"+userId;
        //求交集
        String key2="follows:"+id;
        Set<String> intersect = stringRedisTemplate.opsForSet().intersect(key, key2);
        if (intersect==null||intersect.isEmpty()) {
            return Result.ok(Collections.emptyList());
        }
        //解析出id
        List<Long> ids = intersect.stream().map(Long::valueOf).collect(Collectors.toList());
        //查询用户
        List<User> users = userService.listByIds(ids);
        List<UserDTO> collect = users.stream()
                .map(user -> BeanUtil.copyProperties(user, UserDTO.class))
                .collect(Collectors.toList());
        return Result.ok(collect);
    }
}
