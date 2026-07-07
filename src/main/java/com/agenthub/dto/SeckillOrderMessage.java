package com.agenthub.dto;

import java.io.Serializable;

/**
 * 限量领取订单消息体（Kafka 传递用）
 */
public class SeckillOrderMessage implements Serializable {

    private static final long serialVersionUID = 1L;

    private Long userId;
    private Long voucherId;
    private Long id;  // 订单 ID

    public SeckillOrderMessage() {
    }

    public SeckillOrderMessage(Long userId, Long voucherId, Long id) {
        this.userId = userId;
        this.voucherId = voucherId;
        this.id = id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public Long getVoucherId() {
        return voucherId;
    }

    public void setVoucherId(Long voucherId) {
        this.voucherId = voucherId;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }
}
