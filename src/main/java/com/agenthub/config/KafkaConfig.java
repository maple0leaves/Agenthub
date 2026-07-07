package com.agenthub.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.ContainerProperties;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.util.backoff.FixedBackOff;

/**
 * Kafka 配置（替代 RabbitMQ + Redis Stream 双轨方案）
 */
@Configuration
public class KafkaConfig {

    // --------------- 限量领取订单 Topic ---------------
    public static final String SECKILL_TOPIC = "seckill.order";

    // --------------- Agent 事件 Topic ---------------
    public static final String AGENT_EVENT_TOPIC = "agent.event";

    // --------------- 死信 Topic ---------------
    public static final String SECKILL_DLT_TOPIC = "seckill.order.dlt";
    public static final String AGENT_EVENT_DLT_TOPIC = "agent.event.dlt";

    @Bean
    public NewTopic seckillTopic() {
        return TopicBuilder.name(SECKILL_TOPIC).partitions(1).replicas(1).build();
    }

    @Bean
    public NewTopic agentEventTopic() {
        return TopicBuilder.name(AGENT_EVENT_TOPIC).partitions(1).replicas(1).build();
    }

    @Bean
    public NewTopic seckillDltTopic() {
        return TopicBuilder.name(SECKILL_DLT_TOPIC).partitions(1).replicas(1).build();
    }

    @Bean
    public NewTopic agentEventDltTopic() {
        return TopicBuilder.name(AGENT_EVENT_DLT_TOPIC).partitions(1).replicas(1).build();
    }

    /**
     * 手动提交 offset；失败固定间隔重试 3 次后进入 DLT。
     */
    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> kafkaListenerContainerFactory(
            ConsumerFactory<String, Object> consumerFactory,
            KafkaTemplate<String, Object> kafkaTemplate) {
        ConcurrentKafkaListenerContainerFactory<String, Object> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory);
        factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.MANUAL);
        factory.getContainerProperties().setSyncCommits(true);
        factory.getContainerProperties().setPollTimeout(1500);

        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(
                kafkaTemplate,
                (record, ex) -> new TopicPartition(dltTopicFor(record), 0)
        );
        DefaultErrorHandler errorHandler = new DefaultErrorHandler(recoverer, new FixedBackOff(1000L, 3L));
        // 反序列化失败直接丢弃，避免卡住分区
        errorHandler.addNotRetryableExceptions(
                org.springframework.kafka.support.serializer.DeserializationException.class);
        factory.setCommonErrorHandler(errorHandler);
        return factory;
    }

    /**
     * DLT 专用监听器：手动 ack，不做二次重试，避免 .dlt 再次进入重试链路。
     */
    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, Object> dltKafkaListenerContainerFactory(
            ConsumerFactory<String, Object> consumerFactory) {
        ConcurrentKafkaListenerContainerFactory<String, Object> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory);
        factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.MANUAL);
        factory.getContainerProperties().setSyncCommits(true);
        factory.getContainerProperties().setPollTimeout(1500);
        factory.setCommonErrorHandler(new DefaultErrorHandler(new FixedBackOff(0L, 0L)));
        return factory;
    }

    private String dltTopicFor(ConsumerRecord<?, ?> record) {
        String topic = record.topic();
        if (SECKILL_TOPIC.equals(topic)) {
            return SECKILL_DLT_TOPIC;
        }
        if (AGENT_EVENT_TOPIC.equals(topic)) {
            return AGENT_EVENT_DLT_TOPIC;
        }
        return topic + ".dlt";
    }

}
