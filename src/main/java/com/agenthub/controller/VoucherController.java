package com.agenthub.controller;


import com.agenthub.dto.Result;
import com.agenthub.entity.Voucher;
import com.agenthub.service.IVoucherService;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;

/**
 * <p>
 *  前端控制器
 * </p>
 *
 */
@RestController
@RequestMapping("/voucher")
public class VoucherController {

    @Resource
    private IVoucherService voucherService;

    /**
     * 新增常规试用权益包
     * @param voucher 权益包信息
     * @return 权益包id
     */
    @PostMapping
    public Result addVoucher(@RequestBody Voucher voucher) {
        voucherService.save(voucher);
        return Result.ok(voucher.getId());
    }

     /*生成限量抢领试用包，当前时间需要在开始时间和结束时间之中，否则前端不会展示
    {
        "shopId": 1,
            "title": "100次免费调用",
            "subTitle": "GPT-4级Agent体验",
            "rules": "每人限领1次\\n领取后30天内有效\\n不限Agent类型",
            "payValue": 8000,
            "actualValue": 10000,
            "type": 1,
            "stock":100,
            "beginTime":"2025-12-01T00:00:00",
            "endTime":"2025-12-31T20:00:00"
    }*/
    /**
     * 新增限量抢领试用包
     * @param voucher 权益包信息，包含限量抢领信息
     * @return 权益包id
     */
    @PostMapping("seckill")
    public Result addSeckillVoucher(@RequestBody Voucher voucher) {
        voucherService.addSeckillVoucher(voucher);
        return Result.ok(voucher.getId());
    }

    /**
     * 查询Agent的试用权益包列表
     * @param shopId Agent ID
     * @return 权益包列表
     */
    @GetMapping("/list/{shopId}")
    public Result queryVoucherOfShop(@PathVariable("shopId") Long shopId) {
       return voucherService.queryVoucherOfShop(shopId);
    }
}
