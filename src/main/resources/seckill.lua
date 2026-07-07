---权益包id
local voucherId = ARGV[1]
--用户id
local userId = ARGV[2]
--订单id
local id = ARGV[3]

--库存key
local stockKey = 'seckill:stock:' .. voucherId
--订单key
local orderKey = 'seckill:order:' .. voucherId

--库存是否充足
local stock = tonumber(redis.call('get', stockKey))
--库存key不存在或库存不足
if (not stock) or (stock <= 0) then
    return 1
end

--判断用户是否已领取
--存在用户 禁止重复领取
if (tonumber(redis.call('sismember', orderKey, userId)) == 1) then
    return 2
end

--扣减库存
redis.call('incrby',stockKey,-1)
--领取（保存用户）
redis.call('sadd',orderKey,userId)
-- [已迁移到 Kafka] 消息发送移到 Java 层 kafkaTemplate.send()
-- redis.call('xadd','stream.orders','*','userId',userId,'voucherId',voucherId,'id',id)
return 0

