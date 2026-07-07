package com.agenthub.controller;

import com.agenthub.dto.AgentCreateRequest;
import com.agenthub.dto.AgentForkRequest;
import com.agenthub.dto.AgentSemanticSearchRequest;
import com.agenthub.dto.AgentUpdateRequest;
import com.agenthub.dto.AgentVersionRequest;
import com.agenthub.dto.Result;
import com.agenthub.service.IAgentCommentService;
import com.agenthub.service.IAgentService;
import org.springframework.web.bind.annotation.GetMapping;
import java.util.Map;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.annotation.Resource;

@RestController
@RequestMapping("/agent")
public class AgentController {
    @Resource
    private IAgentService agentService;
    @Resource
    private IAgentCommentService agentCommentService;

    @GetMapping("/categories")
    public Result categories() {
        return agentService.queryCategories();
    }

    @PostMapping
    public Result createAgent(@RequestBody AgentCreateRequest request) {
        return agentService.createAgent(request);
    }

    @PutMapping("/{id}")
    public Result updateAgent(@PathVariable("id") Long id, @RequestBody AgentUpdateRequest request) {
        return agentService.updateAgent(id, request);
    }

    @DeleteMapping("/{id}")
    public Result deleteAgent(@PathVariable("id") Long id) {
        return agentService.deleteAgent(id);
    }

    @GetMapping("/{id}")
    public Result queryAgentById(@PathVariable("id") Long id) {
        return agentService.queryAgentById(id);
    }

    @GetMapping("/list")
    public Result queryAgentList(@RequestParam(value = "categoryId", required = false) Long categoryId,
                                 @RequestParam(value = "keyword", required = false) String keyword,
                                 @RequestParam(value = "sortBy", required = false) String sortBy,
                                 @RequestParam(value = "current", defaultValue = "1") Integer current) {
        return agentService.queryAgentList(categoryId, keyword, sortBy, current);
    }

    @PostMapping("/{id}/versions")
    public Result createVersion(@PathVariable("id") Long id, @RequestBody AgentVersionRequest request) {
        return agentService.createVersion(id, request);
    }

    @GetMapping("/{id}/versions")
    public Result queryVersions(@PathVariable("id") Long id) {
        return agentService.queryVersions(id);
    }

    @PutMapping("/{id}/star")
    public Result toggleStar(@PathVariable("id") Long id) {
        return agentService.toggleStar(id);
    }

    @PostMapping("/{id}/fork")
    public Result forkAgent(@PathVariable("id") Long id, @RequestBody AgentForkRequest request) {
        return agentService.forkAgent(id, request);
    }

    @PostMapping("/{id}/copy")
    public Result copyAgent(@PathVariable("id") Long id,
                            @RequestParam(value = "versionId", required = false) Long versionId) {
        return agentService.copyAgent(id, versionId);
    }

    @GetMapping("/rank")
    public Result rank(@RequestParam(value = "scope", defaultValue = "daily") String scope) {
        return agentService.queryRank(scope);
    }

    @GetMapping("/of/follow")
    public Result queryAgentOfFollow(@RequestParam("lastId") Long max,
                                     @RequestParam(value = "offset", defaultValue = "0") Integer offset) {
        return agentService.queryAgentOfFollow(max, offset);
    }

    @GetMapping("/of/me")
    public Result queryMyAgents() {
        return agentService.queryMyAgents();
    }

    @GetMapping("/of/star")
    public Result queryMyStars() {
        return agentService.queryMyStars();
    }

    @GetMapping("/of/fork")
    public Result queryMyForks() {
        return agentService.queryMyForks();
    }

    @PostMapping("/search/semantic")
    public Result semanticSearch(@RequestBody AgentSemanticSearchRequest request) {
        return agentService.semanticSearch(request);
    }

    @GetMapping("/{id}/comments")
    public Result comments(@PathVariable("id") Long id) {
        return agentCommentService.listByAgentId(id);
    }

    @PostMapping("/{id}/comments")
    public Result addComment(@PathVariable("id") Long id, @RequestBody Map<String, Object> body) {
        Long parentId = body.get("parentId") != null ? Long.valueOf(body.get("parentId").toString()) : null;
        String content = (String) body.get("content");
        return agentCommentService.addComment(id, parentId, content);
    }

    @PutMapping("/comments/{commentId}")
    public Result editComment(@PathVariable("commentId") Long commentId, @RequestBody Map<String, String> body) {
        return agentCommentService.editComment(commentId, body.get("content"));
    }

    @DeleteMapping("/comments/{commentId}")
    public Result deleteComment(@PathVariable("commentId") Long commentId) {
        return agentCommentService.deleteComment(commentId);
    }

    @PutMapping("/comments/{commentId}/like")
    public Result likeComment(@PathVariable("commentId") Long commentId) {
        return agentCommentService.likeComment(commentId);
    }
}
