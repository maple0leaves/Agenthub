/** Agent试用权益包 */
export type Voucher = {
  id: number;
  shopId?: number; // 关联Agent ID
  title?: string; // 权益包名称
  subTitle?: string;
  rules?: string;
  payValue?: number; // 展示原价
  actualValue?: number; // 实际额度
  type?: number; // 0=常规试用, 1=限量抢领
  status?: number;
  stock?: number; // 剩余库存
  beginTime?: string; // 领取开始时间
  endTime?: string; // 领取结束时间
};
