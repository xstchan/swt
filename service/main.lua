local skynet = require "skynet"
local swt    = require "swt"

skynet.start(function()
    skynet.newservice("debug_console", 9001)
    swt.start_master("0.0.0.0:9000")
    swt.start_agent("app", "node1", "127.0.0.1:9002")

    local compute_services = {} -- 用一个表来保存所有计算服务的地址
    local service_count = 5     -- 想要启动的服务数量

    for i = 1, service_count do
        -- 启动服务，可以将索引i作为参数传递给服务，方便它在内部自我标识
        local service_addr = skynet.newservice("computeservice", i)
        compute_services[i] = service_addr
        skynet.error(string.format("计算服务 computeservice_%d 已启动, 地址: %s", i, skynet.address(service_addr)))
    end

    -- 可选：依次向每个计算服务发送消息检查状态
    for i, addr in ipairs(compute_services) do
        local ok, status = pcall(skynet.call, addr, "lua", "GET_STATUS")
        if ok then
            skynet.error(string.format("计算服务 computeservice_%d 状态: %s", i, status))
        else
            skynet.error(string.format("调用计算服务 computeservice_%d 时出现错误", i))
        end
    end
end)
