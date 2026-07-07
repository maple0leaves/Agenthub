package com.agenthub.config;

import com.agenthub.service.IAgentService;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import javax.annotation.Resource;

/**
 * 应用启动后初始化排行榜缓存。
 */
@Component
public class RankBootstrapper implements ApplicationRunner {

    @Resource
    private IAgentService agentService;

    @Override
    public void run(ApplicationArguments args) {
        agentService.initRankFromDB();
    }
}
