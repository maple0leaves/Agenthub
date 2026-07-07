package com.agenthub.interceptor;

import cn.hutool.core.bean.BeanUtil;
import com.baomidou.mybatisplus.core.toolkit.StringUtils;
import com.agenthub.dto.UserDTO;
import com.agenthub.entity.User;
import com.agenthub.utils.RedisConstants;
import com.agenthub.utils.UserHolder;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.annotation.Resource;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.springframework.http.HttpMethod;

/**
 * 登录拦截器
 *
 */
public class LoginInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        // CORS 预检请求不应被登录拦截，否则浏览器会报 Failed to fetch
        if (HttpMethod.OPTIONS.matches(request.getMethod())) {
            return true;
        }
        //获取用户
        if (UserHolder.getUser() == null) {
            //不存在用户 拦截
            response.setStatus(401);
            return false;
        }
        //存在用户放行
        return true;
    }


}
