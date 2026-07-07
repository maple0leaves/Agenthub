import type { Voucher } from '../types';
import { request } from './base';

/** Agent试用权益包API */
export const voucherApi = {
  /** 查询Agent的试用权益包列表 */
  voucherList: (agentId: number) => request<Voucher[]>(`/voucher/list/${agentId}`),
  /** 创建常规试用权益包 */
  createVoucher: (payload: Partial<Voucher>) => request<number>('/voucher', { method: 'POST', body: JSON.stringify(payload) }),
  /** 创建限量抢领试用包 */
  createSeckillVoucher: (payload: Partial<Voucher>) => request<number>('/voucher/seckill', { method: 'POST', body: JSON.stringify(payload) }),
  /** 限量领取试用额度 */
  seckillVoucher: (voucherId: number) => request<number>(`/voucher-order/seckill/${voucherId}`, { method: 'POST' }),
};
