package com.agenthub.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.agenthub.dto.Result;
import com.agenthub.entity.VoucherOrder;
import org.jetbrains.annotations.NotNull;
import org.springframework.transaction.annotation.Transactional;

/**
 * 权益包领取订单服务
 * <p>
 * 服务类
 * </p>
 *
 */
public interface IVoucherOrderService extends IService<VoucherOrder> {

    /**
     * 限量领取权益包
     *
     * @param voucherId 权益包id
     * @return {@link Result}
     */
    Result seckillVoucher(Long voucherId);

    /**
     * 执行领取
     *
     * @param voucherId 权益包id
     * @return {@link Result}
     */
    Result getResult(Long voucherId);

    /**
     * 创建权益包领取订单
     *
     * @param voucherOrder 领取订单
     */
    @NotNull
    @Transactional(rollbackFor = Exception.class)
    void createVoucherOrder(VoucherOrder voucherOrder);
}
