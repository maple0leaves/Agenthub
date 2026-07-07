package com.agenthub.controller;

import com.agenthub.dto.Result;
import com.agenthub.service.IBlogCommentsService;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.util.Map;

@RestController
@RequestMapping("/blog-comments")
public class BlogCommentsController {

    @Resource
    private IBlogCommentsService blogCommentsService;

    @GetMapping("/{blogId}")
    public Result list(@PathVariable("blogId") Long blogId) {
        return blogCommentsService.listByBlogId(blogId);
    }

    @PostMapping("/{blogId}")
    public Result add(@PathVariable("blogId") Long blogId, @RequestBody Map<String, String> body) {
        return blogCommentsService.addComment(blogId, body.get("content"));
    }

    @DeleteMapping("/{commentId}")
    public Result delete(@PathVariable("commentId") Long commentId) {
        return blogCommentsService.deleteComment(commentId);
    }

    @PutMapping("/{commentId}/like")
    public Result like(@PathVariable("commentId") Long commentId) {
        return blogCommentsService.likeComment(commentId);
    }
}
