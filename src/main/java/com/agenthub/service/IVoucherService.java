package com.agenthub.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.agenthub.dto.Result;
import com.agenthub.entity.Voucher;

/**
 * <p>
 *  服务类
 * </p>
 *
 */
public interface IVoucherService extends IService<Voucher> {

    Result queryVoucherOfShop(Long shopId);

    void addSeckillVoucher(Voucher voucher);
}
