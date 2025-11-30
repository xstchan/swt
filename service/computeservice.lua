--[[
Author: 你的名字
Date: 2025-11-30 16:27:48
LastEditors: 你的名字
LastEditTime: 2025-11-30 16:27:56
FilePath: \swt\service\computeservice.lua
Description: 
customString: Copyright (c) 2024 by 你的公司/项目名, All Rights Reserved. 
--]]
local skynet = require "skynet"

local computeservice = {}

-- 模拟计算密集型操作
local function heavy_computation()
    local result = 0
    -- 遍历10000次进行数学计算
    for i = 1, 2500 do
        -- 模拟一些计算：计算平方根、三角函数等
        result = result + math.sqrt(i) * math.sin(i * 0.01) + math.cos(i * 0.02)
        -- 防止编译器优化掉计算
        result = result % 1000000
    end
    return result
end

function computeservice.start()
    skynet.info_func(function()
        return "ComputeService - 每秒执行10000次计算"
    end)
    
    -- 使用定时器每秒执行一次计算
    local function compute_loop()
        while true do
            skynet.sleep(1)  -- 睡眠1秒（100个单位，1单位=10ms）
            
            -- 记录开始时间
            local start_time = skynet.now()
            
            -- 执行计算密集型操作
            local result = heavy_computation()
            
            -- 记录结束时间并计算耗时
            local end_time = skynet.now()
            local cost_time = end_time - start_time
            
            -- 输出日志（在实际项目中可能需要控制日志频率）
            -- skynet.error(string.format("ComputeService: 计算完成，结果=%f, 耗时=%dms", 
            --                          result, cost_time * 10))  -- 转换为毫秒
        end
    end
    
    -- 启动计算循环
    skynet.fork(compute_loop)
    
    skynet.error("ComputeService 启动成功")
end

-- 处理外部消息
function computeservice.dispatch(_, _, command, ...)
    if command == "GET_STATUS" then
        return true, "服务运行中"
    elseif command == "STOP" then
        skynet.exit()
    else
        return false, "未知命令"
    end
end

skynet.start(function()
    skynet.dispatch("lua", computeservice.dispatch)
    computeservice.start()
end)

return computeservice