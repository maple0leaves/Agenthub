package com.agenthub.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.agenthub.entity.AgentVersion;
import com.agenthub.mapper.AgentVersionMapper;
import com.agenthub.service.IAgentVersionService;
import org.springframework.stereotype.Service;

@Service
public class AgentVersionServiceImpl extends ServiceImpl<AgentVersionMapper, AgentVersion> implements IAgentVersionService {
}