package com.agenthub.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.agenthub.entity.AgentCategory;
import com.agenthub.mapper.AgentCategoryMapper;
import com.agenthub.service.IAgentCategoryService;
import org.springframework.stereotype.Service;

@Service
public class AgentCategoryServiceImpl extends ServiceImpl<AgentCategoryMapper, AgentCategory> implements IAgentCategoryService {
}