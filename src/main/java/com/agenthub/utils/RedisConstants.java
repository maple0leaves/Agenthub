package com.agenthub.utils;

public class RedisConstants {
    public static final String LOGIN_CODE_KEY = "login:code:";
    public static final Long LOGIN_CODE_TTL = 2L;
    public static final String LOGIN_USER_KEY = "login:token:";
    public static final Long LOGIN_USER_TTL = 30L;

    public static final Long CACHE_NULL_TTL = 2L;

    public static final String LOCK_CACHE_KEY = "lock:cache:";
    public static final Long LOCK_CACHE_TTL = 10L;

    public static final String SECKILL_STOCK_KEY = "seckill:stock:";
    public static final String BLOG_LIKED_KEY = "blog:liked:";
    public static final String FEED_KEY = "feed:";
    public static final String USER_SIGN_KEY = "sign:";
    public static final String CACHE_AGENT_KEY = "cache:agent:";
    public static final String LOCK_AGENT_KEY = "lock:agent:";
    public static final String AGENT_FEED_KEY = "agent:feed:";
    // Redis Stream 常量（RabbitMQ 不可用时自动启用）
    public static final String AGENT_EVENT_STREAM = "stream.agent.events";
    public static final String AGENT_EVENT_GROUP = "agenthub-g1";
    public static final String AGENT_RANK_DAILY_KEY = "rank:agent:daily:";
    public static final String AGENT_RANK_WEEKLY_KEY = "rank:agent:weekly:";
    public static final String AGENT_RANK_ALL_KEY = "rank:agent:all";
}
