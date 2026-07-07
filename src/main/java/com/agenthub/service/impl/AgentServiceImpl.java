package com.agenthub.service.impl;

import cn.hutool.core.bean.BeanUtil;
import cn.hutool.json.JSONUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.agenthub.dto.AgentCardDTO;
import com.agenthub.dto.AgentCopyResponse;
import com.agenthub.dto.AgentCreateRequest;
import com.agenthub.dto.AgentDetailDTO;
import com.agenthub.dto.AgentForkRequest;
import com.agenthub.dto.AgentIndexRequest;
import com.agenthub.dto.AgentSemanticSearchRequest;
import com.agenthub.dto.AgentUpdateRequest;
import com.agenthub.dto.AgentVersionDTO;
import com.agenthub.dto.AgentVersionRequest;
import com.agenthub.dto.Result;
import com.agenthub.dto.ScrollResult;
import com.agenthub.dto.UserDTO;
import com.agenthub.entity.Agent;
import com.agenthub.entity.AgentCategory;
import com.agenthub.entity.AgentCopyRecord;
import com.agenthub.entity.AgentFork;
import com.agenthub.entity.AgentSearchDoc;
import com.agenthub.entity.AgentStar;
import com.agenthub.entity.AgentVersion;
import com.agenthub.entity.Follow;
import com.agenthub.entity.User;
import com.agenthub.mapper.AgentCopyRecordMapper;
import com.agenthub.mapper.AgentForkMapper;
import com.agenthub.mapper.AgentMapper;
import com.agenthub.mapper.AgentSearchDocMapper;
import com.agenthub.mapper.AgentStarMapper;
import com.agenthub.service.IAgentCategoryService;
import com.agenthub.service.IAgentService;
import com.agenthub.service.IAgentVersionService;
import com.agenthub.service.IFollowService;
import com.agenthub.service.IUserService;
import com.agenthub.config.KafkaConfig;
import com.agenthub.utils.CacheClient;
import com.agenthub.utils.RedisConstants;
import com.agenthub.utils.SystemConstants;
import com.agenthub.utils.UserHolder;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import javax.annotation.Resource;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
public class AgentServiceImpl extends ServiceImpl<AgentMapper, Agent> implements IAgentService {
    private static final int STATUS_PUBLIC = 1;
    private static final long CACHE_TTL_MINUTES = 30L;

    @Resource
    private IAgentCategoryService agentCategoryService;
    @Resource
    private IAgentVersionService agentVersionService;
    @Resource
    private AgentStarMapper agentStarMapper;
    @Resource
    private AgentForkMapper agentForkMapper;
    @Resource
    private AgentCopyRecordMapper agentCopyRecordMapper;
    @Resource
    private AgentSearchDocMapper agentSearchDocMapper;
    @Resource
    private IUserService userService;
    @Resource
    private IFollowService followService;
    @Resource
    private StringRedisTemplate stringRedisTemplate;
    @Resource
    private KafkaTemplate<String, Object> kafkaTemplate;
    @Resource
    private CacheClient cacheClient;

    @Value("${ai.service-url:http://127.0.0.1:8000}")
    private String aiServiceUrl;

    private final RestTemplate restTemplate;

    public AgentServiceImpl() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(12000);
        this.restTemplate = new RestTemplate(factory);
    }

    @Override
    public Result queryCategories() {
        List<AgentCategory> categories = agentCategoryService.lambdaQuery()
                .orderByAsc(AgentCategory::getSort)
                .list();
        return Result.ok(categories);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Result createAgent(AgentCreateRequest request) {
        UserDTO user = UserHolder.getUser();
        if (user == null) {
            return Result.fail("Please login first");
        }
        String validation = validateCreateRequest(request);
        if (validation != null) {
            return Result.fail(validation);
        }

        Agent agent = new Agent();
        agent.setUserId(user.getId());
        agent.setCategoryId(request.getCategoryId());
        agent.setName(request.getName().trim());
        agent.setDescription(request.getDescription());
        agent.setAvatar(request.getAvatar());
        agent.setType(defaultString(request.getType(), "PROMPT"));
        agent.setVisibility(defaultString(request.getVisibility(), "PUBLIC"));
        agent.setStatus(STATUS_PUBLIC);
        agent.setStarCount(0);
        agent.setForkCount(0);
        agent.setCopyCount(0);
        agent.setViewCount(0);
        agent.setVersionCount(1);
        agent.setScore(0);
        save(agent);

        AgentVersion version = newVersion(agent.getId(), null, request.getPromptTemplate(),
                request.getInputSchema(), request.getWorkflowConfig(), request.getModelSuggestion(),
                defaultString(request.getChangelog(), "Initial version"),
                request.getReferences(), request.getScripts(), request.getAssets());
        agentVersionService.save(version);
        updateSearchDoc(agent, version, 0);
        indexAgent(agent, version);
        pushToFollowers(agent.getUserId(), agent.getId());
        publishEvent("PUBLISH_AGENT", agent.getId(), user.getId(), 3);
        return Result.ok(agent.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Result updateAgent(Long id, AgentUpdateRequest request) {
        UserDTO user = UserHolder.getUser();
        if (user == null) {
            return Result.fail("Please login first");
        }
        Agent agent = getById(id);
        if (agent == null) {
            return Result.fail("Agent not found");
        }
        if (!agent.getUserId().equals(user.getId())) {
            return Result.fail("Only the author can update this Agent");
        }
        if (request.getCategoryId() != null) {
            agent.setCategoryId(request.getCategoryId());
        }
        if (StringUtils.hasText(request.getName())) {
            agent.setName(request.getName().trim());
        }
        if (request.getDescription() != null) {
            agent.setDescription(request.getDescription());
        }
        if (request.getAvatar() != null) {
            agent.setAvatar(request.getAvatar());
        }
        if (StringUtils.hasText(request.getType())) {
            agent.setType(request.getType());
        }
        if (StringUtils.hasText(request.getVisibility())) {
            agent.setVisibility(request.getVisibility());
        }
        if (request.getStatus() != null) {
            agent.setStatus(request.getStatus());
        }
        updateById(agent);
        evictAgentCache(id);
        AgentVersion latest = latestVersion(id);
        if (latest != null) {
            updateSearchDoc(agent, latest, 0);
            indexAgent(agent, latest);
        }
        publishEvent("UPDATE_AGENT", id, user.getId(), 0);
        return Result.ok();
    }

    @Override
    public Result queryAgentById(Long id) {
        // 1. 逻辑过期缓存（防击穿）
        AgentDetailDTO detail = cacheClient.queryWithLogicalExpire(
                RedisConstants.CACHE_AGENT_KEY, id, AgentDetailDTO.class,
                (rid) -> {
                    Agent agent = getById(rid);
                    if (agent == null || !canView(agent)) return null;
                    return buildDetail(agent);
                },
                CACHE_TTL_MINUTES, TimeUnit.MINUTES);

        // 2. 缓存未命中 → 回源数据库（兜底，同时完成首次预热）
        if (detail == null) {
            Agent agent = getById(id);
            if (agent == null || !canView(agent)) {
                return Result.fail("Agent not found");
            }
            detail = buildDetail(agent);
            // 预热缓存：写入带逻辑过期时间的数据
            cacheClient.setWithLogicalExpire(
                    RedisConstants.CACHE_AGENT_KEY + id, detail,
                    CACHE_TTL_MINUTES, TimeUnit.MINUTES);
        }

        increaseView(id);
        return Result.ok(detail);
    }

    @Override
    public Result queryAgentList(Long categoryId, String keyword, String sortBy, Integer current) {
        int pageNo = current == null || current < 1 ? 1 : current;
        boolean byScore = "score".equals(sortBy);
        // Default (recommended): score first, so popular templates from all types get mixed exposure
        // Use sortBy=latest for pure newest-first ordering
        String orderSuffix;
        if ("latest".equals(sortBy)) {
            orderSuffix = "id DESC";
        } else if ("starCount".equals(sortBy)) {
            orderSuffix = "star_count DESC, id DESC";
        } else {
            orderSuffix = "score DESC, id DESC";
        }
        // 如果有关键词，也匹配分类名（支持中英文搜索）
        final java.util.List<Long> matchedCategoryIds;
        if (StringUtils.hasText(keyword)) {
            matchedCategoryIds = agentCategoryService.lambdaQuery()
                    .like(com.agenthub.entity.AgentCategory::getName, keyword)
                    .list()
                    .stream()
                    .map(com.agenthub.entity.AgentCategory::getId)
                    .collect(java.util.stream.Collectors.toList());
        } else {
            matchedCategoryIds = java.util.Collections.emptyList();
        }

        com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<Agent> queryWrapper =
                new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<>();
        queryWrapper.eq(categoryId != null, Agent::getCategoryId, categoryId);
        queryWrapper.eq(Agent::getStatus, STATUS_PUBLIC);
        if (StringUtils.hasText(keyword)) {
            final java.util.List<Long> catIds = matchedCategoryIds;
            queryWrapper.and(w -> w
                .like(Agent::getName, keyword)
                .or().like(Agent::getDescription, keyword)
                .or(!catIds.isEmpty(), w2 -> w2.in(Agent::getCategoryId, catIds))
            );
        }
        queryWrapper.last("ORDER BY " + orderSuffix);
        Page<Agent> page = baseMapper.selectPage(new Page<>(pageNo, SystemConstants.MAX_PAGE_SIZE), queryWrapper);
        return Result.ok(toCards(page.getRecords()), page.getTotal());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Result createVersion(Long agentId, AgentVersionRequest request) {
        UserDTO user = UserHolder.getUser();
        if (user == null) {
            return Result.fail("Please login first");
        }
        Agent agent = getById(agentId);
        if (agent == null) {
            return Result.fail("Agent not found");
        }
        if (!agent.getUserId().equals(user.getId())) {
            return Result.fail("Only the author can publish a new version");
        }
        if (request == null || (!StringUtils.hasText(request.getPromptTemplate()) && !StringUtils.hasText(request.getWorkflowConfig()))) {
            return Result.fail("Prompt template or workflow config is required");
        }
        int next = agent.getVersionCount() == null ? 1 : agent.getVersionCount() + 1;
        AgentVersion version = newVersion(agentId, defaultString(request.getVersion(), "v" + next), request.getPromptTemplate(),
                request.getInputSchema(), request.getWorkflowConfig(), request.getModelSuggestion(), request.getChangelog(),
                request.getReferences(), request.getScripts(), request.getAssets());
        agentVersionService.save(version);
        lambdaUpdate().eq(Agent::getId, agentId).setSql("version_count = version_count + 1").update();
        evictAgentCache(agentId);
        Agent refreshed = getById(agentId);
        updateSearchDoc(refreshed, version, 0);
        indexAgent(refreshed, version);
        pushToFollowers(agent.getUserId(), agent.getId());
        publishEvent("UPDATE_AGENT", agentId, user.getId(), 3);
        return Result.ok(version.getId());
    }

    @Override
    public Result queryVersions(Long agentId) {
        Agent agent = getById(agentId);
        if (agent == null || !canView(agent)) {
            return Result.fail("Agent not found");
        }
        List<AgentVersion> versions = agentVersionService.lambdaQuery()
                .eq(AgentVersion::getAgentId, agentId)
                .orderByDesc(AgentVersion::getId)
                .list();
        return Result.ok(versions.stream().map(this::toVersionDTO).collect(Collectors.toList()));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Result toggleStar(Long agentId) {
        UserDTO user = UserHolder.getUser();
        if (user == null) {
            return Result.fail("Please login first");
        }
        Agent agent = getById(agentId);
        if (agent == null || !canView(agent)) {
            return Result.fail("Agent not found");
        }
        Long count = countStar(user.getId(), agentId);
        boolean starred;
        if (count == null || count == 0) {
            AgentStar star = new AgentStar();
            star.setUserId(user.getId());
            star.setAgentId(agentId);
            agentStarMapper.insert(star);
            lambdaUpdate().eq(Agent::getId, agentId).setSql("star_count = star_count + 1").update();
            publishEvent("STAR_AGENT", agentId, user.getId(), 5);
            starred = true;
        } else {
            agentStarMapper.delete(lambdaQueryStar(user.getId(), agentId));
            lambdaUpdate().eq(Agent::getId, agentId).setSql("star_count = IF(star_count > 0, star_count - 1, 0)").update();
            publishEvent("UNSTAR_AGENT", agentId, user.getId(), -5);
            starred = false;
        }
        evictAgentCache(agentId);
        return Result.ok(starred);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Result forkAgent(Long agentId, AgentForkRequest request) {
        UserDTO user = UserHolder.getUser();
        if (user == null) {
            return Result.fail("Please login first");
        }
        Agent source = getById(agentId);
        if (source == null || !canView(source)) {
            return Result.fail("Agent not found");
        }
        AgentVersion latest = latestVersion(agentId);
        if (latest == null) {
            return Result.fail("Agent has no version to fork");
        }
        Agent fork = new Agent();
        fork.setUserId(user.getId());
        fork.setCategoryId(request != null && request.getCategoryId() != null ? request.getCategoryId() : source.getCategoryId());
        fork.setName(request != null && StringUtils.hasText(request.getName()) ? request.getName().trim() : source.getName() + " Fork");
        fork.setDescription(request != null && request.getDescription() != null ? request.getDescription() : source.getDescription());
        fork.setAvatar(request != null && request.getAvatar() != null ? request.getAvatar() : source.getAvatar());
        fork.setType(source.getType());
        fork.setVisibility("PUBLIC");
        fork.setStatus(STATUS_PUBLIC);
        fork.setStarCount(0);
        fork.setForkCount(0);
        fork.setCopyCount(0);
        fork.setViewCount(0);
        fork.setVersionCount(1);
        fork.setScore(0);
        fork.setParentAgentId(source.getId());
        save(fork);

        AgentVersion version = newVersion(fork.getId(), "v1", latest.getPromptTemplate(), latest.getInputSchema(),
                latest.getWorkflowConfig(), latest.getModelSuggestion(), "Forked from Agent #" + source.getId(),
                latest.getReferences(), latest.getScripts(), latest.getAssets());
        agentVersionService.save(version);

        AgentFork record = new AgentFork();
        record.setUserId(user.getId());
        record.setSourceAgentId(source.getId());
        record.setTargetAgentId(fork.getId());
        agentForkMapper.insert(record);
        lambdaUpdate().eq(Agent::getId, source.getId()).setSql("fork_count = fork_count + 1").update();
        evictAgentCache(source.getId());
        updateSearchDoc(fork, version, 0);
        indexAgent(fork, version);
        publishEvent("FORK_AGENT", source.getId(), user.getId(), 8);
        publishEvent("PUBLISH_AGENT", fork.getId(), user.getId(), 3);
        return Result.ok(fork.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Result copyAgent(Long agentId, Long versionId) {
        Agent agent = getById(agentId);
        if (agent == null || !canView(agent)) {
            return Result.fail("Agent not found");
        }
        AgentVersion version = versionId == null ? latestVersion(agentId) : agentVersionService.getById(versionId);
        if (version == null || !version.getAgentId().equals(agentId)) {
            return Result.fail("Agent version not found");
        }
        UserDTO user = UserHolder.getUser();
        if (user != null) {
            AgentCopyRecord record = new AgentCopyRecord();
            record.setUserId(user.getId());
            record.setAgentId(agentId);
            record.setVersionId(version.getId());
            agentCopyRecordMapper.insert(record);
        }
        lambdaUpdate().eq(Agent::getId, agentId).setSql("copy_count = copy_count + 1").update();
        publishEvent("COPY_AGENT", agentId, user == null ? null : user.getId(), 2);
        evictAgentCache(agentId);

        AgentCopyResponse response = new AgentCopyResponse();
        response.setAgentId(agentId);
        response.setVersionId(version.getId());
        response.setPromptTemplate(version.getPromptTemplate());
        response.setInputSchema(version.getInputSchema());
        response.setWorkflowConfig(version.getWorkflowConfig());
        response.setModelSuggestion(version.getModelSuggestion());
        return Result.ok(response);
    }

    @Override
    public Result queryRank(String scope) {
        String key = rankKey(scope);
        Set<String> ids = stringRedisTemplate.opsForZSet().reverseRange(key, 0, SystemConstants.MAX_PAGE_SIZE - 1);
        if (ids == null || ids.isEmpty()) {
            // 周榜为空 → 新的一周刚开始，暂无数据
            if ("weekly".equalsIgnoreCase(scope)) {
                return Result.ok(Collections.emptyList());
            }
            // daily/all 回退 DB
            List<Agent> agents = lambdaQuery().eq(Agent::getStatus, STATUS_PUBLIC)
                    .orderByDesc(Agent::getScore)
                    .last("limit " + SystemConstants.MAX_PAGE_SIZE)
                    .list();
            return Result.ok(toCards(agents));
        }
        List<Long> agentIds = ids.stream().map(Long::valueOf).collect(Collectors.toList());
        return Result.ok(toCardsInOrder(agentIds));
    }

    @Override
    public Result queryAgentOfFollow(Long max, Integer offset) {
        UserDTO user = UserHolder.getUser();
        if (user == null) {
            return Result.fail("Please login first");
        }
        Set<Long> followedAuthorIds = followService.lambdaQuery()
                .eq(Follow::getUserId, user.getId())
                .list()
                .stream()
                .map(Follow::getFollowUserId)
                .collect(Collectors.toSet());
        if (followedAuthorIds.isEmpty()) {
            ScrollResult empty = new ScrollResult();
            empty.setList(Collections.emptyList());
            empty.setMinTime(0L);
            empty.setOffset(0);
            return Result.ok(empty);
        }
        String key = RedisConstants.AGENT_FEED_KEY + user.getId();
        Set<ZSetOperations.TypedTuple<String>> tuples = stringRedisTemplate.opsForZSet()
                .reverseRangeByScoreWithScores(key, 0, max, offset == null ? 0 : offset, SystemConstants.MAX_PAGE_SIZE);
        if (tuples == null || tuples.isEmpty()) {
            return Result.ok();
        }
        List<Long> ids = new ArrayList<>(tuples.size());
        long minTime = 0;
        int os = 1;
        for (ZSetOperations.TypedTuple<String> tuple : tuples) {
            ids.add(Long.valueOf(tuple.getValue()));
            long time = tuple.getScore().longValue();
            if (time == minTime) {
                os++;
            } else {
                minTime = time;
                os = 1;
            }
        }
        ScrollResult result = new ScrollResult();
        // Defensive filter: never show self-authored agents in follow feed.
        result.setList(toCardsInOrder(ids).stream()
                .filter(card -> card.getUserId() != null && followedAuthorIds.contains(card.getUserId()))
                .collect(Collectors.toList()));
        result.setMinTime(minTime);
        result.setOffset(os);
        return Result.ok(result);
    }

    @Override
    public Result semanticSearch(AgentSemanticSearchRequest request) {
        if (request == null || !StringUtils.hasText(request.getQuery())) {
            return Result.fail("Search query cannot be empty");
        }
        int limit = request.getLimit() == null || request.getLimit() < 1 ? SystemConstants.MAX_PAGE_SIZE : Math.min(request.getLimit(), 20);
        List<Long> ids = callSemanticSearch(request.getQuery(), limit);
        if (ids.isEmpty()) {
            return queryAgentList(null, request.getQuery(), null, request.getCurrent());
        }
        return Result.ok(toCardsInOrder(ids));
    }

    @Override
    public Result queryMyAgents() {
        UserDTO user = UserHolder.getUser();
        if (user == null) {
            return Result.fail("Please login first");
        }
        List<Agent> agents = lambdaQuery()
                .eq(Agent::getUserId, user.getId())
                .orderByDesc(Agent::getUpdateTime)
                .list();
        return Result.ok(toCards(agents));
    }

    @Override
    public Result queryMyStars() {
        UserDTO user = UserHolder.getUser();
        if (user == null) {
            return Result.fail("Please login first");
        }
        List<AgentStar> stars = agentStarMapper.selectList(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<AgentStar>()
                .eq(AgentStar::getUserId, user.getId())
                .orderByDesc(AgentStar::getCreateTime));
        List<Long> ids = stars.stream().map(AgentStar::getAgentId).collect(Collectors.toList());
        return Result.ok(toCardsInOrder(ids));
    }

    @Override
    public Result queryMyForks() {
        UserDTO user = UserHolder.getUser();
        if (user == null) {
            return Result.fail("Please login first");
        }
        List<AgentFork> forks = agentForkMapper.selectList(new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<AgentFork>()
                .eq(AgentFork::getUserId, user.getId())
                .orderByDesc(AgentFork::getCreateTime));
        List<Long> ids = forks.stream().map(AgentFork::getTargetAgentId).collect(Collectors.toList());
        return Result.ok(toCardsInOrder(ids));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Result deleteAgent(Long id) {
        UserDTO user = UserHolder.getUser();
        if (user == null) {
            return Result.fail("Please login first");
        }
        Agent agent = getById(id);
        if (agent == null) {
            return Result.fail("Agent not found");
        }
        if (!agent.getUserId().equals(user.getId())) {
            return Result.fail("Only the author can delete this Agent");
        }

        agentVersionService.lambdaUpdate().eq(AgentVersion::getAgentId, id).remove();
        agentStarMapper.delete(new LambdaQueryWrapper<AgentStar>().eq(AgentStar::getAgentId, id));
        agentCopyRecordMapper.delete(new LambdaQueryWrapper<AgentCopyRecord>().eq(AgentCopyRecord::getAgentId, id));
        agentForkMapper.delete(new LambdaQueryWrapper<AgentFork>()
                .eq(AgentFork::getTargetAgentId, id)
                .or()
                .eq(AgentFork::getSourceAgentId, id));
        agentSearchDocMapper.deleteById(id);
        removeById(id);
        evictAgentCache(id);
        if (agent.getParentAgentId() != null) {
            lambdaUpdate()
                    .eq(Agent::getId, agent.getParentAgentId())
                    .setSql("fork_count = IF(fork_count > 0, fork_count - 1, 0)")
                    .update();
            evictAgentCache(agent.getParentAgentId());
        }
        publishEvent("DELETE_AGENT", id, user.getId(), -3);
        return Result.ok();
    }

    private String validateCreateRequest(AgentCreateRequest request) {
        if (request == null) {
            return "Request cannot be empty";
        }
        if (!StringUtils.hasText(request.getName())) {
            return "Agent name cannot be empty";
        }
        if (!StringUtils.hasText(request.getPromptTemplate()) && !StringUtils.hasText(request.getWorkflowConfig())) {
            return "Prompt template or workflow config is required";
        }
        return null;
    }

    private AgentVersion newVersion(Long agentId, String version, String promptTemplate, String inputSchema,
                                    String workflowConfig, String modelSuggestion, String changelog,
                                    String references, String scripts, String assets) {
        AgentVersion entity = new AgentVersion();
        entity.setAgentId(agentId);
        entity.setVersion(defaultString(version, "v1"));
        entity.setPromptTemplate(promptTemplate);
        entity.setInputSchema(inputSchema);
        entity.setWorkflowConfig(workflowConfig);
        entity.setModelSuggestion(defaultString(modelSuggestion, "gpt-4o-mini"));
        entity.setChangelog(changelog);
        entity.setReferences(references);
        entity.setScripts(scripts);
        entity.setAssets(assets);
        return entity;
    }

    private AgentVersion latestVersion(Long agentId) {
        return agentVersionService.lambdaQuery()
                .eq(AgentVersion::getAgentId, agentId)
                .orderByDesc(AgentVersion::getId)
                .last("limit 1")
                .one();
    }

    private AgentDetailDTO buildDetail(Agent agent) {
        AgentDetailDTO detail = new AgentDetailDTO();
        detail.setAgent(toCard(agent));
        List<AgentVersion> versions = agentVersionService.lambdaQuery()
                .eq(AgentVersion::getAgentId, agent.getId())
                .orderByDesc(AgentVersion::getId)
                .list();
        List<AgentVersionDTO> dtos = versions.stream().map(this::toVersionDTO).collect(Collectors.toList());
        detail.setVersions(dtos);
        detail.setLatestVersion(dtos.isEmpty() ? null : dtos.get(0));
        detail.setViewTime(LocalDateTime.now());
        return detail;
    }

    private AgentCardDTO toCard(Agent agent) {
        AgentCardDTO dto = BeanUtil.copyProperties(agent, AgentCardDTO.class);
        User author = userService.getById(agent.getUserId());
        if (author != null) {
            dto.setAuthorName(author.getNickName());
            dto.setAuthorIcon(author.getIcon());
        }
        AgentCategory category = agentCategoryService.getById(agent.getCategoryId());
        if (category != null) {
            dto.setCategoryName(category.getName());
        }
        UserDTO user = UserHolder.getUser();
        dto.setIsStar(user != null && countStar(user.getId(), agent.getId()) > 0);
        return dto;
    }

    private List<AgentCardDTO> toCards(List<Agent> agents) {
        if (agents == null || agents.isEmpty()) {
            return Collections.emptyList();
        }
        return agents.stream().map(this::toCard).collect(Collectors.toList());
    }

    private List<AgentCardDTO> toCardsInOrder(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return Collections.emptyList();
        }
        String joined = ids.stream().map(String::valueOf).collect(Collectors.joining(","));
        List<Agent> agents = lambdaQuery()
                .in(Agent::getId, ids)
                .eq(Agent::getStatus, STATUS_PUBLIC)
                .last("order by field(id," + joined + ")")
                .list();
        return toCards(agents);
    }

    private AgentVersionDTO toVersionDTO(AgentVersion version) {
        return BeanUtil.copyProperties(version, AgentVersionDTO.class);
    }

    private boolean canView(Agent agent) {
        if (agent == null || agent.getStatus() == null || agent.getStatus() != STATUS_PUBLIC) {
            return false;
        }
        if (!"PRIVATE".equalsIgnoreCase(agent.getVisibility())) {
            return true;
        }
        UserDTO user = UserHolder.getUser();
        return user != null && agent.getUserId().equals(user.getId());
    }

    private void increaseView(Long agentId) {
        lambdaUpdate().eq(Agent::getId, agentId).setSql("view_count = view_count + 1").update();
        publishEvent("VIEW_AGENT", agentId, null, 1);
    }

    private Long countStar(Long userId, Long agentId) {
        Long count = agentStarMapper.selectCount(lambdaQueryStar(userId, agentId));
        return count == null ? 0L : count;
    }

    private com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<AgentStar> lambdaQueryStar(Long userId, Long agentId) {
        return new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<AgentStar>()
                .eq(AgentStar::getUserId, userId)
                .eq(AgentStar::getAgentId, agentId);
    }

    private void pushToFollowers(Long authorId, Long agentId) {
        List<Follow> follows = followService.lambdaQuery().eq(Follow::getFollowUserId, authorId).list();
        long now = System.currentTimeMillis();
        for (Follow follow : follows) {
            if (follow.getUserId() != null && follow.getUserId().equals(authorId)) {
                continue;
            }
            stringRedisTemplate.opsForZSet().add(RedisConstants.AGENT_FEED_KEY + follow.getUserId(), agentId.toString(), now);
        }
    }

    private void publishEvent(String type, Long agentId, Long userId, int rankDelta) {
        Map<String, String> body = new LinkedHashMap<>();
        body.put("type", type);
        body.put("agentId", String.valueOf(agentId));
        body.put("userId", userId == null ? "" : String.valueOf(userId));
        body.put("rankDelta", String.valueOf(rankDelta));
        body.put("time", String.valueOf(System.currentTimeMillis()));
        try {
            // 使用 agentId 作为 key，确保同一 Agent 事件顺序一致
            kafkaTemplate.send(KafkaConfig.AGENT_EVENT_TOPIC, body.get("agentId"), body).get(2, TimeUnit.SECONDS);
        } catch (Exception ignored) {
            // 异步增强失败时本地兜底，保证主业务不中断
            handleAgentEvent(new HashMap<Object, Object>(body));
        }
    }

    @Override
    public void handleAgentEvent(Map<Object, Object> event) {
        Long agentId = parseLong(event.get("agentId"));
        Integer rankDelta = parseInteger(event.get("rankDelta"));
        String type = event.get("type") != null ? event.get("type").toString() : "";
        if (rankDelta == null || rankDelta == 0 || agentId == null) {
            return;
        }
        // daily 和 all 排行榜：所有事件都计入
        updateRank(agentId, rankDelta, false);
        // 周排行榜：只计入收藏/取消收藏
        if ("STAR_AGENT".equals(type) || "UNSTAR_AGENT".equals(type)) {
            updateRank(agentId, rankDelta > 0 ? 1 : -1, true);
        }
        if (rankDelta > 0) {
            lambdaUpdate().eq(Agent::getId, agentId).setSql("score = score + " + rankDelta).update();
        } else {
            lambdaUpdate().eq(Agent::getId, agentId).setSql("score = IF(score + " + rankDelta + " > 0, score + " + rankDelta + ", 0)").update();
        }
    }

    private Long parseLong(Object value) {
        if (value == null || !StringUtils.hasText(value.toString())) {
            return null;
        }
        try {
            return Long.valueOf(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Integer parseInteger(Object value) {
        if (value == null || !StringUtils.hasText(value.toString())) {
            return null;
        }
        try {
            return Integer.valueOf(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private void updateRank(Long agentId, int delta, boolean weeklyOnly) {
        String value = agentId.toString();
        if (weeklyOnly) {
            stringRedisTemplate.opsForZSet().incrementScore(rankKey("weekly"), value, delta);
            stringRedisTemplate.expire(rankKey("weekly"), 14, TimeUnit.DAYS);
        } else {
            stringRedisTemplate.opsForZSet().incrementScore(rankKey("daily"), value, delta);
            stringRedisTemplate.opsForZSet().incrementScore(rankKey("all"), value, delta);
            stringRedisTemplate.expire(rankKey("daily"), 2, TimeUnit.DAYS);
        }
    }

    @Override
    public void initRankFromDB() {
        String allKey = RedisConstants.AGENT_RANK_ALL_KEY;
        Long size = stringRedisTemplate.opsForZSet().size(allKey);
        if (size != null && size > 0) {
            return;
        }
        List<Agent> agents = lambdaQuery()
                .eq(Agent::getStatus, STATUS_PUBLIC)
                .orderByDesc(Agent::getScore)
                .list();
        if (agents.isEmpty()) {
            return;
        }
        for (Agent agent : agents) {
            if (agent.getScore() != null && agent.getScore() > 0) {
                String value = agent.getId().toString();
                stringRedisTemplate.opsForZSet().add(rankKey("daily"), value, agent.getScore());
                stringRedisTemplate.opsForZSet().add(allKey, value, agent.getScore());
            }
        }
        // 周榜不预填，从零开始累计本周收藏
        stringRedisTemplate.expire(rankKey("daily"), 2, TimeUnit.DAYS);
    }

    private String rankKey(String scope) {
        LocalDate now = LocalDate.now();
        if ("weekly".equalsIgnoreCase(scope)) {
            return RedisConstants.AGENT_RANK_WEEKLY_KEY + now.format(DateTimeFormatter.ofPattern("yyyyww"));
        }
        if ("all".equalsIgnoreCase(scope)) {
            return RedisConstants.AGENT_RANK_ALL_KEY;
        }
        return RedisConstants.AGENT_RANK_DAILY_KEY + now.format(DateTimeFormatter.BASIC_ISO_DATE);
    }

    private void updateSearchDoc(Agent agent, AgentVersion version, Integer status) {
        AgentSearchDoc doc = new AgentSearchDoc();
        doc.setAgentId(agent.getId());
        doc.setVersionId(version.getId());
        doc.setTitle(agent.getName());
        doc.setContent(buildIndexContent(agent, version));
        doc.setEmbeddingStatus(status);
        doc.setUpdateTime(LocalDateTime.now());
        AgentSearchDoc exists = agentSearchDocMapper.selectById(agent.getId());
        if (exists == null) {
            agentSearchDocMapper.insert(doc);
        } else {
            agentSearchDocMapper.updateById(doc);
        }
    }

    private String buildIndexContent(Agent agent, AgentVersion version) {
        StringBuilder builder = new StringBuilder();
        builder.append(defaultString(agent.getName(), "")).append('\n');
        builder.append(defaultString(agent.getDescription(), "")).append('\n');
        builder.append(defaultString(agent.getType(), "")).append('\n');
        builder.append(defaultString(version.getPromptTemplate(), "")).append('\n');
        builder.append(defaultString(version.getWorkflowConfig(), ""));
        return builder.toString();
    }

    private void indexAgent(Agent agent, AgentVersion version) {
        AgentIndexRequest index = new AgentIndexRequest();
        index.setAgentId(agent.getId());
        index.setVersionId(version.getId());
        index.setTitle(agent.getName());
        index.setContent(buildIndexContent(agent, version));
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            restTemplate.exchange(trimAiUrl() + "/api/agents/index", HttpMethod.POST, new HttpEntity<>(index, headers), Map.class);
            updateSearchDoc(agent, version, 1);
        } catch (RestClientException e) {
            updateSearchDoc(agent, version, 2);
        }
    }

    private List<Long> callSemanticSearch(String query, int limit) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("query", query);
        payload.put("limit", limit);
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            ResponseEntity<Map> response = restTemplate.exchange(trimAiUrl() + "/api/agents/search", HttpMethod.POST,
                    new HttpEntity<>(payload, headers), Map.class);
            Map body = response.getBody();
            Object idsObject = body == null ? null : (body.containsKey("agentIds") ? body.get("agentIds") : body.get("agent_ids"));
            if (!(idsObject instanceof List)) {
                return Collections.emptyList();
            }
            List result = (List) idsObject;
            List<Long> ids = new ArrayList<>();
            for (Object item : result) {
                if (item != null) {
                    ids.add(Long.valueOf(item.toString()));
                }
            }
            return ids;
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private String trimAiUrl() {
        String value = aiServiceUrl == null || aiServiceUrl.isEmpty() ? "http://127.0.0.1:8000" : aiServiceUrl;
        while (value.endsWith("/")) {
            value = value.substring(0, value.length() - 1);
        }
        return value;
    }

    private void evictAgentCache(Long id) {
        stringRedisTemplate.delete(RedisConstants.CACHE_AGENT_KEY + id);
    }

    private String defaultString(String value, String fallback) {
        return StringUtils.hasText(value) ? value : fallback;
    }

    // ============================================================
    // 以下为缓存学习材料（注释代码），演示三种缓存问题的解决方案
    // 当前生产代码使用的是 CacheClient.queryWithLogicalExpire()
    // ============================================================

    /* 方案1：设置空值解决缓存穿透
    private Agent queryWithPassThrough(Long id) {
        String key = CACHE_AGENT_KEY + id;
        String json = stringRedisTemplate.opsForValue().get(key);
        if (StringUtils.hasText(json)) {
            return JSONUtil.toBean(json, Agent.class);
        }
        // 命中的是空字符串 → 防止穿透，直接返回 null
        if ("".equals(json)) {
            return null;
        }
        Agent agent = getById(id);
        if (agent == null) {
            // 将空值写入 Redis，设置较短 TTL，防止恶意查询穿透到 DB
            stringRedisTemplate.opsForValue().set(key, "", CACHE_NULL_TTL, TimeUnit.SECONDS);
            return null;
        }
        stringRedisTemplate.opsForValue().set(key, JSONUtil.toJsonStr(agent), CACHE_AGENT_TTL, TimeUnit.MINUTES);
        return agent;
    }
    */

    /* 方案2：互斥锁解决缓存击穿
    private Agent queryWithMutex(Long id) {
        String key = CACHE_AGENT_KEY + id;
        String json = stringRedisTemplate.opsForValue().get(key);
        if (StringUtils.hasText(json)) {
            return JSONUtil.toBean(json, Agent.class);
        }
        if ("".equals(json)) {
            return null;
        }
        String lockKey = LOCK_AGENT_KEY + id;
        Agent agent = null;
        try {
            // SETNX 获取互斥锁
            boolean gotLock = tryLock(lockKey);
            if (!gotLock) {
                // 没拿到锁 → 休眠重试
                Thread.sleep(50);
                return queryWithMutex(id);
            }
            // 拿到锁 → Double Check + 重建缓存
            json = stringRedisTemplate.opsForValue().get(key);
            if (StringUtils.hasText(json)) {
                return JSONUtil.toBean(json, Agent.class);
            }
            agent = getById(id);
            if (agent == null) {
                stringRedisTemplate.opsForValue().set(key, "", CACHE_NULL_TTL, TimeUnit.SECONDS);
                return null;
            }
            stringRedisTemplate.opsForValue().set(key, JSONUtil.toJsonStr(agent), CACHE_AGENT_TTL, TimeUnit.MINUTES);
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        } finally {
            unLock(lockKey);
        }
        return agent;
    }
    */

    /* 方案3：逻辑过期解决缓存击穿（当前生产方案）
    private Agent queryWithLogicalExpire(Long id) {
        String key = CACHE_AGENT_KEY + id;
        String json = stringRedisTemplate.opsForValue().get(key);
        if (StringUtils.isEmpty(json)) {
            return null;
        }
        RedisData redisData = JSONUtil.toBean(json, RedisData.class);
        Agent agent = BeanUtil.toBean((JSONObject) redisData.getData(), Agent.class);
        // 未过期直接返回，已过期返回旧数据 + 异步重建
        if (redisData.getExpireTime().isAfter(LocalDateTime.now())) {
            return agent;
        }
        String lockKey = LOCK_AGENT_KEY + id;
        if (tryLock(lockKey)) {
            // 拿锁成功 → 异步线程重建缓存
            CACHE_REBUILD_EXECUTOR.submit(() -> {
                try {
                    Agent newAgent = getById(id);
                    redisData.setData(newAgent);
                    redisData.setExpireTime(LocalDateTime.now().plusSeconds(1800));
                    stringRedisTemplate.opsForValue().set(key, JSONUtil.toJsonStr(redisData));
                } finally {
                    unLock(lockKey);
                }
            });
        }
        // 无论是否拿到锁，都返回旧数据，保证可用性
        return agent;
    }
    */
}

