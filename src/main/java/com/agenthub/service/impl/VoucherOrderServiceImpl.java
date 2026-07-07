package com.agenthub.service.impl;

import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.agenthub.config.KafkaConfig;
import com.agenthub.dto.Result;
import com.agenthub.dto.SeckillOrderMessage;
import com.agenthub.dto.UserDTO;
import com.agenthub.entity.SeckillVoucher;
import com.agenthub.entity.VoucherOrder;
import com.agenthub.mapper.VoucherOrderMapper;
import com.agenthub.service.ISeckillVoucherService;
import com.agenthub.service.IVoucherOrderService;
import com.agenthub.utils.RedisIdWorker;
import com.agenthub.utils.RedisConstants;
import com.agenthub.utils.UserHolder;
import lombok.extern.slf4j.Slf4j;
import org.jetbrains.annotations.NotNull;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.context.annotation.Lazy;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.Resource;
import java.util.Collections;
import java.util.concurrent.TimeUnit;

/**
 * <p>
 * 服务实现类
 * </p>
 *
 */
@Service
@Slf4j
public class VoucherOrderServiceImpl extends ServiceImpl<VoucherOrderMapper, VoucherOrder> implements IVoucherOrderService {
    @Resource
    private ISeckillVoucherService seckillVoucherService;
    @Resource
    private RedisIdWorker redisIdWorker;
    @Resource
    private RedissonClient redissonClient;
    @Resource
    private StringRedisTemplate stringRedisTemplate;
    @Resource
    private KafkaTemplate<String, Object> kafkaTemplate;
    /**
     * 自己注入自己为了获取代理对象 @Lazy 延迟注入 避免形成循环依赖
     */
    @Resource
    @Lazy
    private IVoucherOrderService voucherOrderService;
    private static final DefaultRedisScript<Long> SECKILL_SCRIPT;


    private void handleVoucherOrder(VoucherOrder voucherOrder) {
        Long userId = voucherOrder.getUserId();
        //创建锁对象（兜底）
        RLock lock = redissonClient.getLock("lock:order:" + userId);
        //获取锁
        boolean isLock = lock.tryLock();
        //判断是否获取锁成功
        if (!isLock) {
            //获取失败,返回错误或者重试
            throw new RuntimeException("发送未知错误");
        }
        try {
            voucherOrderService.createVoucherOrder(voucherOrder);
        } finally {
            //释放锁
            lock.unlock();
        }

    }

    static {
        SECKILL_SCRIPT = new DefaultRedisScript<>();
        SECKILL_SCRIPT.setLocation(new ClassPathResource("seckill.lua"));
        SECKILL_SCRIPT.setResultType(Long.class);
    }

    /**
     * 限量试用额度领取（Kafka 异步处理）
     *
     * @param voucherId 权益包id
     * @return {@link Result}
     */
    @Override
    public Result seckillVoucher(Long voucherId) {
        //获取用户
        UserDTO user = UserHolder.getUser();
        // 历史数据可能仅在DB中有库存，先做一次懒加载兜底，避免Lua读取到nil
        ensureSeckillStock(voucherId);
        //获取订单id
        Long orderId = redisIdWorker.nextId("order");
        //执行lua脚本（查库存+防重复+扣库存，不再包含XADD）
        Long res = stringRedisTemplate.execute(
                SECKILL_SCRIPT
                , Collections.emptyList()
                , voucherId.toString()
                , user.getId().toString()
                , orderId.toString());
        //判断结果是否为0
        int r = res.intValue();
        if (r != 0) {
            //不为0 没有领取资格
            return Result.fail(r == 1 ? "试用额度已抢完" : "请勿重复领取");
        }

        SeckillOrderMessage message = new SeckillOrderMessage(user.getId(), voucherId, orderId);
        try {
            // 使用 userId 作为 key，保证同一用户消息有序
            kafkaTemplate.send(KafkaConfig.SECKILL_TOPIC, user.getId().toString(), message).get(2, TimeUnit.SECONDS);
        } catch (Exception e) {
            log.error("Kafka 发送失败，降级同步处理, orderId={}", orderId, e);
            fallbackSyncOrder(user.getId(), voucherId, orderId);
        }

        return Result.ok(orderId);
    }

    /**
     * MQ 发送失败时的同步兜底
     */
    private void fallbackSyncOrder(Long userId, Long voucherId, Long orderId) {
        VoucherOrder fallbackOrder = new VoucherOrder();
        fallbackOrder.setId(orderId);
        fallbackOrder.setUserId(userId);
        fallbackOrder.setVoucherId(voucherId);
        handleVoucherOrder(fallbackOrder);
    }

    private void ensureSeckillStock(Long voucherId) {
        String stockKey = RedisConstants.SECKILL_STOCK_KEY + voucherId;
        String stock = stringRedisTemplate.opsForValue().get(stockKey);
        if (stock != null) {
            return;
        }
        SeckillVoucher seckillVoucher = seckillVoucherService.getById(voucherId);
        if (seckillVoucher == null || seckillVoucher.getStock() == null) {
            return;
        }
        stringRedisTemplate.opsForValue().setIfAbsent(stockKey, String.valueOf(seckillVoucher.getStock()));
    }
    @Override
    @NotNull
    @Transactional(rollbackFor = Exception.class)
    public Result getResult(Long voucherId) {
        //是否已领取
        Long userId = UserHolder.getUser().getId();
        Long count = lambdaQuery()
                .eq(VoucherOrder::getVoucherId, voucherId)
                .eq(VoucherOrder::getUserId, userId)
                .count();
        if (count > 0) {
            return Result.fail("请勿重复领取");
        }
        //扣减库存
        boolean isSuccess = seckillVoucherService.update(
                new LambdaUpdateWrapper<SeckillVoucher>()
                        .eq(SeckillVoucher::getVoucherId, voucherId)
                        .gt(SeckillVoucher::getStock, 0)
                        .setSql("stock=stock-1"));
        if (!isSuccess) {
            //库存不足
            return Result.fail("库存不足");
        }
        //创建订单
        VoucherOrder voucherOrder = new VoucherOrder();
        Long orderId = redisIdWorker.nextId("order");
        voucherOrder.setVoucherId(voucherId);
        voucherOrder.setUserId(UserHolder.getUser().getId());
        voucherOrder.setId(orderId);
        this.save(voucherOrder);
        //返回订单id
        return Result.ok(orderId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void createVoucherOrder(VoucherOrder voucherOrder) {
        //扣减库存
        boolean isSuccess = seckillVoucherService.update(
                new LambdaUpdateWrapper<SeckillVoucher>()
                        .eq(SeckillVoucher::getVoucherId, voucherOrder.getVoucherId())
                        .gt(SeckillVoucher::getStock, 0)
                        .setSql("stock=stock-1"));
        //创建订单
        this.save(voucherOrder);
    }
}
