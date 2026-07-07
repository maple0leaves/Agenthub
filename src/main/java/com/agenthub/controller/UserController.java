package com.agenthub.controller;


import cn.hutool.core.bean.BeanUtil;
import cn.hutool.core.io.FileUtil;
import cn.hutool.core.util.StrUtil;
import com.agenthub.dto.LoginFormDTO;
import com.agenthub.dto.RegisterFormDTO;
import com.agenthub.dto.Result;
import com.agenthub.dto.UserProfileUpdateRequest;
import com.agenthub.dto.UserDTO;
import com.agenthub.entity.User;
import com.agenthub.entity.UserInfo;
import com.agenthub.service.IUserInfoService;
import com.agenthub.service.IUserService;
import com.agenthub.utils.SystemConstants;
import com.agenthub.utils.UserHolder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.annotation.Resource;
import javax.servlet.http.HttpSession;
import java.io.File;
import java.io.IOException;
import java.util.UUID;

/**
 * <p>
 * 前端控制器
 * </p>
 *
 */
@Slf4j
@RestController
@RequestMapping("/user")
public class UserController {

    @Resource
    private IUserService userService;

    @Resource
    private IUserInfoService userInfoService;

    /**
     * 登录功能
     * @param loginForm 登录参数，包含手机号、密码
     */
    @PostMapping("/login")
    public Result login(@RequestBody LoginFormDTO loginForm, HttpSession session){
        return userService.login(loginForm,session);
    }

    /**
     * 注册功能
     */
    @PostMapping("/register")
    public Result register(@RequestBody RegisterFormDTO registerForm) {
        return userService.register(registerForm);
    }

    /**
     * 登出功能
     * @return 无
     */
    @PostMapping("/logout")
    public Result logout(@RequestHeader(value = "authorization", required = false) String token){
        return userService.logout(token);
    }

    @GetMapping("/me")
    public Result me(){
        //  获取当前登录的用户并返回
        return Result.ok(UserHolder.getUser());
    }

    @PutMapping("/profile")
    public Result updateProfile(@RequestBody UserProfileUpdateRequest request,
                                @RequestHeader(value = "authorization", required = false) String token) {
        return userService.updateProfile(token, request == null ? null : request.getNickName());
    }

    @GetMapping("/info/{id}")
    public Result info(@PathVariable("id") Long userId){
        // 查询详情
        UserInfo info = userInfoService.getById(userId);
        if (info == null) {
            // 没有详情，应该是第一次查看详情
            return Result.ok();
        }
        info.setCreateTime(null);
        info.setUpdateTime(null);
        // 返回
        return Result.ok(info);
    }
    @GetMapping("/{id}")
    public Result queryUserById(@PathVariable("id")Long userId){
        User user = userService.getById(userId);
        if (user==null){
            return Result.ok();
        }
        UserDTO userDTO = BeanUtil.copyProperties(user, UserDTO.class);
        return Result.ok(userDTO);
    }
    @PostMapping("/avatar")
    public Result uploadAvatar(@RequestParam("file") MultipartFile file,
                               @RequestHeader(value = "authorization", required = false) String token) {
        try {
            // 确保上传根目录存在
            File baseDir = new File(SystemConstants.IMAGE_UPLOAD_DIR);
            if (!baseDir.exists()) {
                baseDir.mkdirs();
            }
            String originalFilename = file.getOriginalFilename();
            String suffix = StrUtil.subAfter(originalFilename, ".", true);
            String name = UUID.randomUUID().toString();
            int hash = name.hashCode();
            int d1 = hash & 0xF;
            int d2 = (hash >> 4) & 0xF;
            File dir = new File(SystemConstants.IMAGE_UPLOAD_DIR, StrUtil.format("/avatars/{}/{}", d1, d2));
            if (!dir.exists()) {
                dir.mkdirs();
            }
            String fileName = StrUtil.format("/avatars/{}/{}/{}.{}", d1, d2, name, suffix);
            file.transferTo(new File(SystemConstants.IMAGE_UPLOAD_DIR, fileName));
            String avatarUrl = "/imgs" + fileName;
            return userService.updateAvatar(token, avatarUrl);
        } catch (IOException e) {
            throw new RuntimeException("头像上传失败", e);
        }
    }

    @PostMapping("/sign")
    public Result sign(){
        return userService.sign();
    }
    @GetMapping("/sign/count")
    public Result signCount(){
        return userService.signCount();
    }
}
