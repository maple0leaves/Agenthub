package com.agenthub.config;

import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Component;

/**
 * DLT 消费者：统一记录失败消息上下文，供人工排查与补偿。
 */
@Slf4j
@Component
public class KafkaDltConsumers {

    @KafkaListener(
            topics = KafkaConfig.SECKILL_DLT_TOPIC,
            groupId = "agenthub-dlt-seckill-group",
            containerFactory = "dltKafkaListenerContainerFactory"
    )
    public void handleSeckillDlt(
            ConsumerRecord<String, Object> record,
            Acknowledgment acknowledgment,
            @Header(value = KafkaHeaders.DLT_ORIGINAL_TOPIC, required = false) String originalTopic,
            @Header(value = KafkaHeaders.DLT_ORIGINAL_PARTITION, required = false) Integer originalPartition,
            @Header(value = KafkaHeaders.DLT_ORIGINAL_OFFSET, required = false) Long originalOffset,
            @Header(value = KafkaHeaders.DLT_EXCEPTION_MESSAGE, required = false) String exceptionMessage) {
        try {
            log.error("[DLT][Seckill] topic={}, partition={}, offset={}, key={}, value={}, originalTopic={}, originalPartition={}, originalOffset={}, reason={}",
                    record.topic(), record.partition(), record.offset(), record.key(), record.value(),
                    originalTopic, originalPartition, originalOffset, exceptionMessage);
            // 这里可以接入告警或补偿任务（如转人工工单、二次回放等）
            acknowledgment.acknowledge();
        } catch (Exception e) {
            log.error("[DLT][Seckill] 处理失败，跳过重试并提交偏移，避免阻塞", e);
            acknowledgment.acknowledge();
        }
    }

    @KafkaListener(
            topics = KafkaConfig.AGENT_EVENT_DLT_TOPIC,
            groupId = "agenthub-dlt-agent-event-group",
            containerFactory = "dltKafkaListenerContainerFactory"
    )
    public void handleAgentEventDlt(
            ConsumerRecord<String, Object> record,
            Acknowledgment acknowledgment,
            @Header(value = KafkaHeaders.DLT_ORIGINAL_TOPIC, required = false) String originalTopic,
            @Header(value = KafkaHeaders.DLT_ORIGINAL_PARTITION, required = false) Integer originalPartition,
            @Header(value = KafkaHeaders.DLT_ORIGINAL_OFFSET, required = false) Long originalOffset,
            @Header(value = KafkaHeaders.DLT_EXCEPTION_MESSAGE, required = false) String exceptionMessage) {
        try {
            log.error("[DLT][AgentEvent] topic={}, partition={}, offset={}, key={}, value={}, originalTopic={}, originalPartition={}, originalOffset={}, reason={}",
                    record.topic(), record.partition(), record.offset(), record.key(), record.value(),
                    originalTopic, originalPartition, originalOffset, exceptionMessage);
            acknowledgment.acknowledge();
        } catch (Exception e) {
            log.error("[DLT][AgentEvent] 处理失败，跳过重试并提交偏移，避免阻塞", e);
            acknowledgment.acknowledge();
        }
    }
}
