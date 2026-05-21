# 联机肉鸽塔防 — 服务端

> Node.js 18 + WebSocket，**支持零依赖运行**（内存模式），生产可平滑切换 MongoDB / Redis / uWebSockets.js。

---

## 快速开始

```bash
cd server
npm install          # 安装 ws；mongodb / ioredis 是 optionalDependency，按需安装
npm start            # 监听 8765
node test/run.js     # 跑集成测试（11 用例）
```

环境变量任意一条都可不填，未设置时走默认实现：

| 变量 | 默认 | 说明 |
|------|------|------|
| `PORT` | 8765 | WebSocket 端口 |
| `WS_IMPL` | ws | `ws`（纯 JS） / `uws`（uWebSockets.js，生产）|
| `MONGO_URL` |（空） | 不填走内存仓库 |
| `MONGO_DB` | rtd | MongoDB 库名 |
| `REDIS_URL` |（空） | 不填走内存缓存 |
| `WX_APP_ID` / `WX_APP_SECRET` |（空） | 不填走 mock openid |
| `LOG_LEVEL` | INFO | DEBUG/INFO/WARN/ERROR |
| `JWT_SECRET` | dev_secret_change_me | **生产必须修改** |
| `MAX_ROOMS` | 2000 | 单实例房间上限 |
| `MAX_PLAYERS_PER_ROOM` | 4 | 单房上限 |
| `STATE_HASH_INTERVAL_WAVES` | 3 | 状态哈希校验频次 |

可以用 `.env.example` 拷一份 `.env` 后用：

```bash
node --env-file=.env src/index.js
```

---

## 设计要点

### 权威策略（简化版）

| 类别 | 谁负责 | 说明 |
|------|--------|------|
| 房间生命周期 | **服务端** | 创建/加入/踢人/房主转移 |
| 玩家操作 | **服务端转发** | frame_input → frame_broadcast，按 15 Hz 节奏发 |
| 战斗推进 | 客户端 | 基于服务端下发的 seed 派生地图/怪物 |
| **骰子** | **服务端真随机** | `crypto.randomBytes`，防预测 |
| **抽卡** | **服务端真随机 + 保底** | 保底计数器持久化 |
| 状态一致性 | 多数派投票 | 每 3 波各客户端上报 hash，少数派被要求 rejoin |
| 结算入库 | 房主上报，服务端校验后写库 |

### 通信协议

所有消息统一格式：

```jsonc
// 请求
{ "type": "create_room", "seq": 7, "timestamp": 1700000000000, "data": { "difficulty": 2 } }

// 响应（seq 透传）
{ "type": "create_room_rsp", "seq": 7, "timestamp": ..., "data": { "success": true, "room": {...} } }

// 错误
{ "type": "error", "seq": 7, "data": { "code": "UNAUTHORIZED", "message": "...", "refType": "create_room" } }

// 服务端主动推送（无 seq）
{ "type": "frame_broadcast", "timestamp": ..., "data": { "frameId": 100, "inputs": {...} } }
```

完整消息类型见 `src/shared/MessageTypes.js`，**必须与客户端 `assets/scripts/network/MessageProtocol.js` 严格一致**。

### 消息处理列表

| Type | 鉴权 | 功能 |
|------|:---:|------|
| `auth_login` | ❌ | 微信 code 换 openid + 签 token |
| `reconnect`  | ❌ | 用 token 恢复 openid + 重新绑定房间 |
| `create_room` | ✅ | 房主创建房间 |
| `join_room` | ✅ | 加入房间号 |
| `leave_room` | ✅ | 退出当前房间 |
| `kick_player` | ✅ | 房主踢人 |
| `player_ready` | ✅ | 切换准备状态 |
| `start_match` | ✅ | 加入匹配队列（含 AI 填充） |
| `cancel_match` | ✅ | 取消匹配 |
| `battle_start` | ✅ | 房主开始战斗 |
| `frame_input` | ✅ | 上报本帧操作（无响应） |
| `roll_dice` | ✅ | 请求服务端骰子（返回 + 房间广播）|
| `draw_gacha` | ✅ | 请求服务端抽卡 |
| `state_hash` | ✅ | 上报本地状态哈希 |
| `game_over` | ✅ | 房主上报战斗结果 → 写库 |
| `chat_message` | ✅ | 房间内聊天 + 限频 + 敏感词 |
| `spectate_join` / `spectate_leave` | ✅ | 观战 |
| `get_leaderboard` | ❌ | 取排行榜 |
| `analytics_batch` | ❌ | 客户端埋点上报 |
| `ping` / `pong` | ❌ | 心跳 |

---

## 目录结构

```
server/
├── package.json
├── .env.example
├── test/run.js                       # 集成测试（11 用例）
└── src/
    ├── index.js                      # 启动入口 + 注册所有 handler
    ├── config/index.js               # 配置加载
    ├── shared/MessageTypes.js        # 与客户端共享的协议常量
    ├── util/
    │   ├── Logger.js                 # 分级日志（含时间戳/PID）
    │   └── Helpers.js                # ID/Hash/JWT/限流/真随机
    ├── ws/
    │   ├── Server.js                 # 兼容 uWS / ws 的服务封装
    │   ├── Connection.js             # 单连接抽象（含心跳监控）
    │   └── Router.js                 # type → handler 分发
    ├── auth/
    │   ├── WxAuth.js                 # code2session（含 mock）
    │   └── AuthService.js            # 登录 + JWT 签发
    ├── store/                        # 持久化仓库
    │   ├── IUserRepo.js              # 接口
    │   ├── MemoryUserRepo.js         # 内存实现（默认）
    │   ├── MongoUserRepo.js          # MongoDB 实现
    │   └── index.js                  # 工厂
    ├── cache/index.js                # Memory + Redis 双实现
    ├── room/
    │   ├── Room.js                   # 房间数据 + DTO
    │   └── RoomManager.js            # 房间管理 + 房主转移 + 重连
    ├── match/MatchService.js         # 按难度分桶匹配 + AI 填充
    ├── battle/
    │   ├── DiceServer.js             # 服务端真随机骰子
    │   ├── GachaServer.js            # 服务端真随机抽卡 + 保底
    │   └── BattleSession.js          # 战斗会话（帧转发 + 哈希校验 + 结算）
    ├── chat/ChatService.js           # 聊天 + 敏感词 + 频率限制
    ├── leaderboard/LeaderboardService.js  # 排行榜（5 分钟缓存）
    └── analytics/AnalyticsService.js # 埋点接收
```

---

## 部署建议

### 开发期
```bash
# 零依赖；进程重启数据丢失
node src/index.js
```

### 测试环境
```bash
docker run -d -p 27017:27017 mongo:6
docker run -d -p 6379:6379 redis:7

cd server
npm install mongodb ioredis        # 安装可选依赖
MONGO_URL=mongodb://localhost:27017 REDIS_URL=redis://localhost:6379 \
  node src/index.js
```

### 生产
- **uWebSockets.js**：吞吐 > ws 库 10×；性能关键，需 native 编译
  ```bash
  npm install uNetworking/uWebSockets.js#v20.43.0
  WS_IMPL=uws node src/index.js
  ```
- **MongoDB 副本集**：建议 3 节点，用户存档高可用
- **Redis 主从**：用于：在线会话、房间到节点映射（多机部署）、限流计数、排行榜
- **多实例 + 负载均衡**：在 Nginx 前置 WebSocket 反向代理，按 `Sec-WebSocket-Key` 一致性哈希到固定后端
- **Prometheus**：可在 `src/index.js` 暴露 `/metrics` 端口（待实现）
- **微信小程序**：必须 wss 协议；TLS 证书由 Nginx 终结

### 部署 Checklist
- [ ] `JWT_SECRET` 改为强随机
- [ ] 关闭 `DEBUG` 日志级别
- [ ] 配置 `WX_APP_ID` / `WX_APP_SECRET`
- [ ] MongoDB / Redis 已开启认证
- [ ] uWS 已编译并通过 `WS_IMPL=uws` 启用
- [ ] 进程管理：systemd / pm2
- [ ] 反向代理 wss + 防火墙白名单

---

## 测试

```bash
node test/run.js
```

集成测试覆盖：
1. 双玩家登录
2. 创建 / 加入房间 + 广播
3. 准备 + 房主启动战斗
4. 帧输入转发（双向）
5. 服务端骰子真随机 + 抽卡 + 保底
6. 聊天广播
7. 频率限制
8. 战斗结算 + 写库
9. 房主踢人
10. 断线重连
11. 鉴权拦截

也可在客户端项目根目录运行联机端到端测试：
```bash
cd ..
node tools/online_sim.js
```

---

## 与客户端的耦合点

| 文件 | 说明 |
|------|------|
| `server/src/shared/MessageTypes.js` | **必须与客户端 `assets/scripts/network/MessageProtocol.js` 严格一致** |
| `server/src/battle/DiceServer.js` | 与客户端 `assets/scripts/config/DicePoolConfig.js` 数值必须保持同步 |
| `server/src/battle/GachaServer.js` | 与客户端 `assets/scripts/config/GachaPoolConfig.js` 数值必须保持同步 |

> 建议未来把数值表抽到 `shared/` 目录由双方同步读取，目前为避免引入构建工具未做。

---

## 已知 TODO

- [x] ~~排行榜 ZSET 分页~~（已完成，支持 offset/limit）
- [x] ~~房主"暂停投票"消息处理~~（已完成）
- [x] ~~观战延迟队列~~（SpectatorDelayQueue，默认 20 秒）
- [x] ~~Prometheus 指标~~（METRICS_PORT 启用）
- [x] ~~微信内容安全审核~~（util/WxContentSec.js 已接入）
- [x] ~~排行榜防刷规则~~（≥ 2 真人 / 无 AI / 时长 ≥ 3min / 每日 1 次上榜）
- [x] ~~Docker 化~~（Dockerfile + docker-compose.yml）
- [ ] 多机部署：用 Redis Stream 转发跨实例的房间消息
- [ ] uWebSockets.js 验证（当前 `npm install` 时 optionalDependency，主动验证）
- [ ] MongoDB events 集合 TTL 索引（埋点数据老化）

## Docker 部署

```bash
# 开发环境（含 Mongo + Redis）
cd server
docker-compose up -d

# 仅起服务端（外部已有 Mongo/Redis）
docker build -t rtd-server:latest -f server/Dockerfile ..
docker run -d -p 8765:8765 -p 9090:9090 \
  -e MONGO_URL=mongodb://your-mongo:27017 \
  -e REDIS_URL=redis://your-redis:6379 \
  -e JWT_SECRET=your_strong_secret \
  rtd-server:latest

# 看 metrics
curl http://localhost:9090/metrics
```
