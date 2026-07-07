package com.agenthub.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.agenthub.dto.AiChatRequest;
import com.agenthub.dto.Result;
import com.agenthub.dto.UserDTO;
import com.agenthub.entity.Agent;
import com.agenthub.service.IAgentService;
import com.agenthub.utils.UserHolder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import javax.annotation.Resource;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Slf4j
@RestController
@RequestMapping("/ai")
public class AiController {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ExecutorService streamExecutor = Executors.newCachedThreadPool();

    public AiController() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10000);
        factory.setReadTimeout(60000);
        this.restTemplate = new RestTemplate(factory);
    }

    @Value("${ai.service-url:http://127.0.0.1:8000}")
    private String aiServiceUrl;

    @Value("${deepseek.api-key:}")
    private String deepseekApiKey;

    @Value("${deepseek.api-url:https://api.deepseek.com/v1/chat/completions}")
    private String deepseekApiUrl;

    @Value("${deepseek.model:deepseek-chat}")
    private String deepseekModel;

    @Resource
    private IAgentService agentService;

    // ==================== RAG 检索 ====================

    /**
     * 语义检索相关模板列表。
     * 优先调用 Python/Milvus 向量检索，不可用时回退到 MySQL keyword 搜索。
     */
    private List<Map<String, Object>> searchRelevantTemplates(String query) {
        // 1) 尝试 Milvus 向量检索
        String pythonUrl = trimTrailingSlash(aiServiceUrl) + "/api/agents/search";
        try {
            Map<String, Object> searchPayload = new HashMap<>();
            searchPayload.put("query", query);
            searchPayload.put("limit", 5);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            ResponseEntity<Map> resp = restTemplate.exchange(pythonUrl, HttpMethod.POST,
                    new HttpEntity<>(searchPayload, headers), Map.class);
            Map<String, Object> body = resp.getBody();
            if (body != null && body.containsKey("results")) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> results = (List<Map<String, Object>>) body.get("results");
                if (results != null && !results.isEmpty()) {
                    return results;
                }
            }
        } catch (Exception ignored) {
            // Python 不可用 → 回退
        }

        // 2) 回退：MySQL keyword 搜索
        try {
            List<Agent> agents = agentService.lambdaQuery()
                    .eq(Agent::getStatus, 1)
                    .and(q -> q.like(Agent::getName, query).or().like(Agent::getDescription, query))
                    .orderByDesc(Agent::getStarCount)
                    .last("limit 5")
                    .list();
            List<Map<String, Object>> fallback = new ArrayList<>();
            if (agents != null) {
                for (Agent a : agents) {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("agentId", a.getId());
                    item.put("title", a.getName());
                    item.put("content", a.getDescription() != null ? a.getDescription() : "");
                    item.put("score", (double) (a.getStarCount() != null ? a.getStarCount() : 0));
                    fallback.add(item);
                }
            }
            return fallback;
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    // ==================== System Prompt 构建 ====================

    private String buildSystemPrompt(String userMessage) {
        StringBuilder sb = new StringBuilder();
        sb.append("你是一个 AI Agent 模板社区的智能助手（火火），帮助用户发现、创建和使用 AI Agent 模板。请用中文回复，格式使用 Markdown。");

        // 注入热门模板
        try {
            List<Agent> hotAgents = agentService.lambdaQuery()
                    .eq(Agent::getStatus, 1)
                    .orderByDesc(Agent::getStarCount)
                    .last("limit 10")
                    .list();
            if (hotAgents != null && !hotAgents.isEmpty()) {
                sb.append("\n\n当前社区热门模板（可在回复中推荐给用户）：");
                for (int i = 0; i < hotAgents.size(); i++) {
                    Agent a = hotAgents.get(i);
                    sb.append("\n").append(i + 1).append(". **").append(a.getName()).append("**");
                    if (a.getDescription() != null && !a.getDescription().isEmpty()) {
                        String desc = a.getDescription().length() > 60
                                ? a.getDescription().substring(0, 60) + "..."
                                : a.getDescription();
                        sb.append(" — ").append(desc);
                    }
                    sb.append(" (⭐").append(a.getStarCount() != null ? a.getStarCount() : 0).append(", ID:").append(a.getId()).append(")");
                }
            }
        } catch (Exception ignored) {}

        // 注入 RAG 检索结果
        List<Map<String, Object>> ragResults = searchRelevantTemplates(userMessage);
        if (!ragResults.isEmpty()) {
            sb.append("\n\n以下是与用户问题最相关的模板（优先推荐这些）：");
            for (int i = 0; i < ragResults.size(); i++) {
                Map<String, Object> r = ragResults.get(i);
                sb.append("\n").append(i + 1).append(". **").append(r.get("title")).append("**");
                Object content = r.get("content");
                if (content != null && !content.toString().isEmpty()) {
                    String c = content.toString().length() > 60
                            ? content.toString().substring(0, 60) + "..."
                            : content.toString();
                    sb.append(" — ").append(c);
                }
                sb.append(" (匹配度:").append(String.format("%.2f", r.get("score") != null ? ((Number) r.get("score")).doubleValue() : 0)).append(")");
            }
        }

        return sb.toString();
    }

    // ==================== 非流式端点 ====================

    @PostMapping("/chat/deepseek")
    public Result chatDeepseek(@RequestBody Map<String, Object> request) {
        String message = (String) request.get("message");
        if (message == null || message.trim().isEmpty()) {
            return Result.fail("请输入问题");
        }
        if (deepseekApiKey == null || deepseekApiKey.isEmpty()) {
            return Result.fail("Deepseek API Key 未配置");
        }

        try {
            List<Map<String, String>> messagesList = buildMessages(message, request.get("history"));
            Map<String, Object> payload = new HashMap<>();
            payload.put("model", deepseekModel);
            payload.put("messages", messagesList);
            payload.put("max_tokens", 2048);
            payload.put("temperature", 0.7);

            HttpHeaders headers = deepseekHeaders();
            ResponseEntity<Map> response = restTemplate.exchange(
                    deepseekApiUrl, HttpMethod.POST,
                    new HttpEntity<>(payload, headers), Map.class);

            Map<String, Object> body = response.getBody();
            if (body == null) return Result.fail("Deepseek API 返回为空");

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> choices = (List<Map<String, Object>>) body.get("choices");
            if (choices == null || choices.isEmpty()) return Result.fail("Deepseek API 无回复");

            @SuppressWarnings("unchecked")
            Map<String, Object> msg = (Map<String, Object>) choices.get(0).get("message");
            String content = (String) msg.get("content");

            Map<String, Object> result = new HashMap<>();
            result.put("role", "assistant");
            result.put("content", content);
            // 附带 sources
            result.put("sources", buildSourceList(message));
            return Result.ok(result);
        } catch (ResourceAccessException e) {
            return Result.fail("Deepseek API 暂时不可用，请稍后重试");
        } catch (RestClientException e) {
            return Result.fail("Deepseek API 调用失败: " + e.getMessage());
        }
    }

    // ==================== SSE 流式端点 ====================

    @PostMapping("/chat/stream")
    public SseEmitter chatStream(@RequestBody Map<String, Object> request) {
        String message = (String) request.get("message");
        SseEmitter emitter = new SseEmitter(120_000L); // 2 分钟超时

        if (message == null || message.trim().isEmpty()) {
            try {
                emitter.send(SseEmitter.event().name("error").data("请输入问题"));
                emitter.complete();
            } catch (Exception ignored) {}
            return emitter;
        }
        if (deepseekApiKey == null || deepseekApiKey.isEmpty()) {
            try {
                emitter.send(SseEmitter.event().name("error").data("Deepseek API Key 未配置"));
                emitter.complete();
            } catch (Exception ignored) {}
            return emitter;
        }

        streamExecutor.execute(() -> {
            try {
                List<Map<String, String>> messagesList = buildMessages(message, request.get("history"));
                Map<String, Object> payload = new HashMap<>();
                payload.put("model", deepseekModel);
                payload.put("messages", messagesList);
                payload.put("max_tokens", 2048);
                payload.put("temperature", 0.7);
                payload.put("stream", true);

                HttpHeaders headers = deepseekHeaders();
                // 使用不带缓冲的 HttpURLConnection 来读取 SSE 流
                java.net.URL url = new java.net.URL(deepseekApiUrl);
                java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Authorization", "Bearer " + deepseekApiKey);
                conn.setDoOutput(true);
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(120000);

                // 写入请求体
                String jsonBody = objectMapper.writeValueAsString(payload);
                try (java.io.OutputStream os = conn.getOutputStream()) {
                    os.write(jsonBody.getBytes("UTF-8"));
                    os.flush();
                }

                // 先发送 RAG sources
                List<Map<String, Object>> sources = buildSourceList(message);
                emitter.send(SseEmitter.event().name("sources").data(sources));

                // 读取 SSE 响应
                int responseCode = conn.getResponseCode();
                if (responseCode != 200) {
                    emitter.send(SseEmitter.event().name("error").data("Deepseek API 返回错误: " + responseCode));
                    emitter.complete();
                    return;
                }

                StringBuilder fullContent = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        if (line.startsWith("data: ")) {
                            String data = line.substring(6).trim();
                            if ("[DONE]".equals(data)) break;

                            try {
                                @SuppressWarnings("unchecked")
                                Map<String, Object> chunk = objectMapper.readValue(data, Map.class);
                                @SuppressWarnings("unchecked")
                                List<Map<String, Object>> choices = (List<Map<String, Object>>) chunk.get("choices");
                                if (choices != null && !choices.isEmpty()) {
                                    @SuppressWarnings("unchecked")
                                    Map<String, Object> delta = (Map<String, Object>) choices.get(0).get("delta");
                                    if (delta != null && delta.containsKey("content")) {
                                        String token = (String) delta.get("content");
                                        if (token != null) {
                                            fullContent.append(token);
                                            emitter.send(SseEmitter.event().name("token").data(token));
                                        }
                                    }
                                }
                            } catch (Exception ignored) {
                                // 跳过解析失败的 chunk
                            }
                        }
                    }
                }

                // 发送完成后缀
                Map<String, Object> done = new LinkedHashMap<>();
                done.put("content", fullContent.toString());
                emitter.send(SseEmitter.event().name("done").data(done));
                emitter.complete();

            } catch (Exception e) {
                try {
                    emitter.send(SseEmitter.event().name("error").data("AI 服务出错: " + e.getMessage()));
                    emitter.complete();
                } catch (Exception ignored) {}
            }
        });

        return emitter;
    }

    // ==================== 旧端点（保持兼容） ====================

    @PostMapping("/chat/rag")
    public Result chatRag(@RequestBody Map<String, Object> request,
                          @RequestHeader(value = "authorization", required = false) String token) {
        String message = (String) request.get("message");
        if (message == null || message.trim().isEmpty()) {
            return Result.fail("请输入问题");
        }
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (token != null && !token.trim().isEmpty()) {
            headers.set("authorization", token);
        }
        String url = trimTrailingSlash(aiServiceUrl) + "/api/chat/rag";
        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    url, HttpMethod.POST, new HttpEntity<>(request, headers), Map.class);
            return Result.ok(response.getBody());
        } catch (ResourceAccessException e) {
            return Result.fail("AI服务暂时不可用");
        } catch (RestClientException e) {
            return Result.fail("AI服务调用失败");
        }
    }

    @PostMapping("/chat")
    public Result chat(@RequestBody AiChatRequest request,
                       @RequestHeader(value = "authorization", required = false) String token) {
        if (request == null || request.getMessage() == null || request.getMessage().trim().isEmpty()) {
            return Result.fail("请输入想咨询的问题");
        }
        Map<String, Object> payload = new HashMap<>();
        payload.put("message", request.getMessage());
        payload.put("x", request.getX());
        payload.put("y", request.getY());
        UserDTO user = UserHolder.getUser();
        if (user != null) {
            Map<String, Object> userPayload = new HashMap<>();
            userPayload.put("id", user.getId());
            userPayload.put("nickName", user.getNickName());
            userPayload.put("icon", user.getIcon());
            payload.put("user", userPayload);
        }
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (token != null && !token.trim().isEmpty()) {
            headers.set("authorization", token);
        }
        String url = trimTrailingSlash(aiServiceUrl) + "/api/chat";
        try {
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST,
                    new HttpEntity<>(payload, headers), Map.class);
            return Result.ok(response.getBody());
        } catch (ResourceAccessException e) {
            return Result.fail("AI服务暂时不可用，请确认Python服务已启动");
        } catch (RestClientException e) {
            return Result.fail("AI服务调用失败，请稍后再试");
        }
    }

    // ==================== 内部辅助 ====================

    private List<Map<String, String>> buildMessages(String message, Object historyObj) {
        List<Map<String, String>> list = new ArrayList<>();

        Map<String, String> sys = new HashMap<>();
        sys.put("role", "system");
        sys.put("content", buildSystemPrompt(message));
        list.add(sys);

        if (historyObj instanceof List) {
            for (Object item : (List<?>) historyObj) {
                if (item instanceof Map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> m = (Map<String, Object>) item;
                    Map<String, String> entry = new HashMap<>();
                    entry.put("role", String.valueOf(m.getOrDefault("role", "user")));
                    entry.put("content", String.valueOf(m.getOrDefault("content", "")));
                    list.add(entry);
                }
            }
        }

        Map<String, String> userMsg = new HashMap<>();
        userMsg.put("role", "user");
        userMsg.put("content", message);
        list.add(userMsg);

        return list;
    }

    private List<Map<String, Object>> buildSourceList(String query) {
        List<Map<String, Object>> sources = new ArrayList<>();
        try {
            List<Map<String, Object>> results = searchRelevantTemplates(query);
            for (Map<String, Object> r : results) {
                Map<String, Object> src = new LinkedHashMap<>();
                src.put("agentId", r.get("agentId"));
                src.put("agentName", r.get("title"));
                sources.add(src);
            }
        } catch (Exception ignored) {}
        return sources;
    }

    private HttpHeaders deepseekHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + deepseekApiKey);
        return headers;
    }

    private String trimTrailingSlash(String value) {
        if (value == null || value.isEmpty()) return "http://127.0.0.1:8000";
        while (value.endsWith("/")) value = value.substring(0, value.length() - 1);
        return value;
    }
}
