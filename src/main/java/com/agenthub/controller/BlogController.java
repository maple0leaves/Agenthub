package com.agenthub.controller;


import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.agenthub.dto.Result;
import com.agenthub.dto.UserDTO;
import com.agenthub.entity.Blog;
import com.agenthub.entity.User;
import com.agenthub.service.IBlogService;
import com.agenthub.service.IUserService;
import com.agenthub.utils.SystemConstants;
import com.agenthub.utils.UserHolder;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import java.util.List;

/**
 * <p>
 * Agent评测社区控制器
 * </p>
 *
 */
@RestController
@RequestMapping("/blog")
public class BlogController {

    @Resource
    private IBlogService blogService;

    @PostMapping
    public Result saveBlog(@RequestBody Blog blog) {
        return blogService.saveBlog(blog);
    }

    @PutMapping("/like/{id}")
    public Result likeBlog(@PathVariable("id") Long id) {
        // 修改点赞数量
        return blogService.likeBlog(id);
    }

    @GetMapping("/of/me")
    public Result queryMyBlog(@RequestParam(value = "current", defaultValue = "1") Integer current) {
        // 获取登录用户
        UserDTO user = UserHolder.getUser();
        // 根据用户查询
        Page<Blog> page = blogService.query()
                .eq("user_id", user.getId()).page(new Page<>(current, SystemConstants.MAX_PAGE_SIZE));
        // 获取当前页数据
        List<Blog> records = page.getRecords();
        records.forEach(blogService::populateBlogUser);
        return Result.ok(records);
    }

    @GetMapping("/hot")
    public Result queryHotBlog(@RequestParam(value = "current", defaultValue = "1") Integer current) {
        return blogService.queryHotBlog(current);
    }

    @GetMapping("/{id}")
    public Result queryBlogById(@PathVariable("id") Long id) {
        return blogService.queryBlogById(id);
    }
    @GetMapping("/likes/{id}")
    public Result queryBlogLikesById(@PathVariable("id") Long id) {
        return blogService.queryBlogLikesById(id);
    }

    @GetMapping("/of/user")
    public Result queryBlogByUserId(@RequestParam(value = "current",defaultValue = "1")Integer current,
                                    @RequestParam("id")Long id){
        Page<Blog> page = blogService.query().eq("user_id", id)
                .page(new Page<>(current, SystemConstants.MAX_PAGE_SIZE));

        List<Blog> records = page.getRecords();
        return Result.ok(records);
    }
    @GetMapping("/of/follow")
    public Result queryBlogOfFollow(@RequestParam("lastId")Long max,@RequestParam(value = "offset",defaultValue = "0")Integer offset){
        return blogService.queryBlogOfFollow(max,offset);
    }

    @DeleteMapping("/{id}")
    public Result deleteBlog(@PathVariable("id") Long id) {
        UserDTO user = UserHolder.getUser();
        if (user == null) return Result.fail("请先登录");
        Blog blog = blogService.getById(id);
        if (blog == null) return Result.fail("动态不存在");
        if (!blog.getUserId().equals(user.getId())) return Result.fail("只能删除自己的动态");
        blogService.removeById(id);
        return Result.ok();
    }
}
