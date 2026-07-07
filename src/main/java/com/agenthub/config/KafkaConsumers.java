package com.agenthub.config;

import com.agenthub.dto.SeckillOrderMessage;
import com.agenthub.entity.VoucherOrder;
import com.agenthub.service.IAgentService;
import com.agenthub.service.IVoucherOrderService;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Component;

import javax.annotation.Resource;
import java.util.HashMap;
import java.util.Map;

/**
 * Kafka 消费者。
 */
@Slf4j
@Component
public class KafkaConsumers {

    @Resource
    private IVoucherOrderService voucherOrderService;

    @Resource
    private RedissonClient redissonClient;

    @Resource
    private IAgentService agentService;

    @KafkaListener(topics = KafkaConfig.SECKILL_TOPIC, containerFactory = "kafkaListenerContainerFactory")
    public void handleSeckillOrder(SeckillOrderMessage message, Acknowledgment acknowledgment) {
        try {
            VoucherOrder voucherOrder = new VoucherOrder();
            voucherOrder.setId(message.getId());
            voucherOrder.setUserId(message.getUserId());
            voucherOrder.setVoucherId(message.getVoucherId());

            Long userId = voucherOrder.getUserId();
            RLock lock = redissonClient.getLock("lock:order:" + userId);
            boolean isLock = lock.tryLock();
            if (!isLock) {
                log.warn("获取分布式锁失败，userId={}", userId);
                throw new IllegalStateException("lock not acquired");
            }
            try {
                voucherOrderService.createVoucherOrder(voucherOrder);
                acknowledgment.acknowledge();
            } finally {
                lock.unlock();
            }
        } catch (Exception e) {
            log.error("处理限量领取订单失败, orderId={}", message.getId(), e);
            throw e;
        }
    }

    @KafkaListener(topics = KafkaConfig.AGENT_EVENT_TOPIC, containerFactory = "kafkaListenerContainerFactory")
    public void handleAgentEvent(Map<String, String> event, Acknowledgment acknowledgment) {
        try {
            agentService.handleAgentEvent(new HashMap<>(event));
            acknowledgment.acknowledge();
        } catch (Exception e) {
            log.error("处理 Agent 事件失败, event={}", event, e);
            throw e;
        }
    }
}
