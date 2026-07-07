package com.agenthub.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.agenthub.dto.LoginFormDTO;
import com.agenthub.dto.RegisterFormDTO;
import com.agenthub.dto.Result;
import com.agenthub.entity.User;

import javax.servlet.http.HttpSession;

/**
 * <p>
 *  服务类
 * </p>
 *
 */
public interface IUserService extends IService<User> {

    /**
     * 登录
     *
     * @param loginForm 登录表单
     * @param session   会话
     * @return {@link Result}
     */
    Result login(LoginFormDTO loginForm, HttpSession session);

    /**
     * 注册
     *
     * @param registerForm 注册参数
     * @return {@link Result}
     */
    Result register(RegisterFormDTO registerForm);

    /**
     * 登出
     *
     * @param token 授权 token
     * @return {@link Result}
     */
    Result logout(String token);

    /**
     * 签到
     *
     * @return {@link Result}
     */
    Result sign();

    /**
     * 统计连续签到
     *
     * @return {@link Result}
     */
    Result signCount();

    /**
     * 更新当前用户资料
     *
     * @param token 授权 token
     * @param nickName 昵称
     * @return {@link Result}
     */
    Result updateProfile(String token, String nickName);

    /**
     * 更新当前用户头像
     *
     * @param token 授权 token
     * @param icon 头像 URL
     * @return {@link Result}
     */
    Result updateAvatar(String token, String icon);
}
