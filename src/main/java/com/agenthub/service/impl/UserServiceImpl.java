package com.agenthub.service.impl;

import cn.hutool.core.bean.BeanUtil;
import cn.hutool.core.bean.copier.CopyOptions;
import cn.hutool.core.lang.UUID;
import cn.hutool.core.util.RandomUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.agenthub.dto.LoginFormDTO;
import com.agenthub.dto.RegisterFormDTO;
import com.agenthub.dto.Result;
import com.agenthub.dto.UserDTO;
import com.agenthub.entity.User;
import com.agenthub.mapper.UserMapper;
import com.agenthub.service.IUserService;
import com.agenthub.utils.PasswordEncoder;
import com.agenthub.utils.RedisConstants;
import com.agenthub.utils.RegexUtils;
import com.agenthub.utils.UserHolder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.BitFieldSubCommands;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.annotation.Resource;
import javax.servlet.http.HttpSession;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import static com.agenthub.utils.RedisConstants.*;
import static com.agenthub.utils.SystemConstants.*;


/**
 * <p>
 * 服务实现类
 * </p>
 *
 */
@Service
@Slf4j
public class UserServiceImpl extends ServiceImpl<UserMapper, User> implements IUserService {
    @Resource
    private StringRedisTemplate stringRedisTemplate;

    @Override
    public Result login(LoginFormDTO loginForm, HttpSession session) {
        String phone = loginForm.getPhone();
        if (RegexUtils.isPhoneInvalid(phone)) {
            return Result.fail("手机号格式错误");
        }
        String password = loginForm.getPassword();
        if (password == null || password.length() < 6) {
            return Result.fail("密码至少 6 位");
        }
        User user = queryByPhone(phone);
        if (user == null) {
            user = createUserWithPhone(phone, password);
        }
        if (user.getPassword() == null || !PasswordEncoder.matches(user.getPassword(), password)) {
            return Result.fail("手机号或密码错误");
        }
        return buildTokenResult(user);
    }

    @Override
    public Result register(RegisterFormDTO registerForm) {
        String phone = registerForm.getPhone();
        if (RegexUtils.isPhoneInvalid(phone)) {
            return Result.fail("手机号格式错误");
        }
        String password = registerForm.getPassword();
        if (password == null || password.length() < 6) {
            return Result.fail("密码至少 6 位");
        }
        User user = queryByPhone(phone);
        if (user != null && user.getPassword() != null) {
            return Result.fail("该手机号已注册");
        }
        if (user == null) {
            user = createUserWithPhone(phone, password);
        } else {
            user.setPassword(PasswordEncoder.encode(password));
            baseMapper.updateById(user);
        }
        return buildTokenResult(user);
    }

    @Override
    public Result logout(String token) {
        if (token == null || token.trim().isEmpty()) {
            return Result.ok();
        }
        stringRedisTemplate.delete(LOGIN_USER_KEY + token.trim());
        return Result.ok();
    }

    private Result buildTokenResult(User user) {
        String token = UUID.randomUUID().toString(true);
        UserDTO userDTO = BeanUtil.copyProperties(user, UserDTO.class);
        Map<String, Object> map = BeanUtil.beanToMap(userDTO, new HashMap<>()
                , CopyOptions.create().setIgnoreNullValue(true)
                        .setFieldValueEditor(
                                (name, value) -> value.toString()
                        ));
        stringRedisTemplate.opsForHash().putAll(LOGIN_USER_KEY + token, map);
        stringRedisTemplate.expire(LOGIN_USER_KEY + token, LOGIN_USER_TTL, TimeUnit.MINUTES);
        return Result.ok(token);
    }

    private User queryByPhone(String phone) {
        return baseMapper.selectOne(new LambdaQueryWrapper<User>().eq(User::getPhone, phone));
    }

    @Override
    public Result sign() {
        //获取当前登陆用户
        Long id = UserHolder.getUser().getId();
        //获取日期
        LocalDateTime now = LocalDateTime.now();
        //拼接key
        String yyyyMM = now.format(DateTimeFormatter.ofPattern("yyyy:MM:"));
        String key = USER_SIGN_KEY +yyyyMM+ id;
        //获取今天是本月的第几天
        int dayOfMonth = now.getDayOfMonth();
        //写了redis
        stringRedisTemplate.opsForValue().setBit(key,dayOfMonth-1,true);
        return Result.ok();
    }

    @Override
    public Result signCount() {
        //获取当前登陆用户
        Long id = UserHolder.getUser().getId();
        //获取日期
        LocalDateTime now = LocalDateTime.now();
        //拼接key
        String yyyyMM = now.format(DateTimeFormatter.ofPattern("yyyy:MM:"));
        String key = USER_SIGN_KEY +yyyyMM+ id;
        //获取今天是本月的第几天
        int dayOfMonth = now.getDayOfMonth();
        //获取截至本月今天的所有签到记录
        List<Long> result = stringRedisTemplate.opsForValue().bitField(key
                , BitFieldSubCommands
                        .create()
                        .get(BitFieldSubCommands.BitFieldType
                                .unsigned(dayOfMonth))
                        .valueAt(0)
        );
        if (result==null||result.isEmpty()){
            return Result.ok(0);
        }
        Long num = result.get(0);
        if (num==null||num==0){
            return Result.ok(0);
        }
        //转二进制字符串
        String binaryString = Long.toBinaryString(num);
        //计算连续签到天数
        int count=0;
        for (int i = binaryString.length()-1; i >=0; i--) {
            if (binaryString.charAt(i)=='1'){
                count++;
            }
            else {
                break;
            }
        }
        //返回
        return Result.ok(count);
    }

    @Override
    public Result updateProfile(String token, String nickName) {
        UserDTO current = UserHolder.getUser();
        if (current == null) {
            return Result.fail("Please login first");
        }
        String value = nickName == null ? "" : nickName.trim();
        if (!StringUtils.hasText(value)) {
            return Result.fail("昵称不能为空");
        }
        if (value.length() > 20) {
            return Result.fail("昵称最多 20 个字符");
        }
        User user = getById(current.getId());
        if (user == null) {
            return Result.fail("用户不存在");
        }
        user.setNickName(value);
        updateById(user);
        if (StringUtils.hasText(token)) {
            stringRedisTemplate.opsForHash().put(LOGIN_USER_KEY + token, "nickName", value);
        }
        UserDTO dto = BeanUtil.copyProperties(user, UserDTO.class);
        return Result.ok(dto);
    }

    @Override
    public Result updateAvatar(String token, String icon) {
        UserDTO current = UserHolder.getUser();
        if (current == null) {
            return Result.fail("Please login first");
        }
        String value = icon == null ? "" : icon.trim();
        if (!StringUtils.hasText(value)) {
            return Result.fail("头像不能为空");
        }
        // 用 lambdaUpdate 显式更新 icon，避免 MyBatis-Plus NOT_NULL 策略跳过该字段
        boolean updated = lambdaUpdate()
                .eq(User::getId, current.getId())
                .set(User::getIcon, value)
                .update();
        if (!updated) {
            return Result.fail("头像更新失败");
        }
        if (StringUtils.hasText(token)) {
            stringRedisTemplate.opsForHash().put(LOGIN_USER_KEY + token, "icon", value);
        }
        User user = getById(current.getId());
        UserDTO dto = BeanUtil.copyProperties(user, UserDTO.class);
        return Result.ok(dto);
    }

    private User createUserWithPhone(String phone, String rawPassword) {
        User user = new User();
        user.setPhone(phone);
        user.setPassword(PasswordEncoder.encode(rawPassword));
        //生成随机昵称
        user.setNickName(USER_NICK_NAME_PREFIX + RandomUtil.randomString(10));
        baseMapper.insert(user);
        return user;
    }
}
