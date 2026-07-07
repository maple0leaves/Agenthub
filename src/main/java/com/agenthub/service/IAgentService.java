package com.agenthub.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.agenthub.dto.AgentCreateRequest;
import com.agenthub.dto.AgentForkRequest;
import com.agenthub.dto.AgentSemanticSearchRequest;
import com.agenthub.dto.AgentUpdateRequest;
import com.agenthub.dto.AgentVersionRequest;
import com.agenthub.dto.Result;
import com.agenthub.entity.Agent;

import java.util.Map;

public interface IAgentService extends IService<Agent> {
    Result queryCategories();
    Result createAgent(AgentCreateRequest request);
    Result updateAgent(Long id, AgentUpdateRequest request);
    Result queryAgentById(Long id);
    Result queryAgentList(Long categoryId, String keyword, String sortBy, Integer current);
    Result createVersion(Long agentId, AgentVersionRequest request);
    Result queryVersions(Long agentId);
    Result toggleStar(Long agentId);
    Result forkAgent(Long agentId, AgentForkRequest request);
    Result copyAgent(Long agentId, Long versionId);
    Result queryRank(String scope);
    Result queryAgentOfFollow(Long max, Integer offset);
    Result semanticSearch(AgentSemanticSearchRequest request);
    Result queryMyAgents();
    Result queryMyStars();
    Result queryMyForks();
    Result deleteAgent(Long id);
    void handleAgentEvent(Map<Object, Object> event);
    void initRankFromDB();
}
