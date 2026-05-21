# 联机肉鸽塔防 — 交付说明（TS 迁移版）

> **架构定型**：Cocos Creator 3.8 + TypeScript (ESM) + Node.js 服务端 (CommonJS)
> **三套自动化测试全绿**：sim / sim_ui / online_sim / server test

---

## 1. 仓库结构

```
RoguelikeApp/                       # 工程根目录
├── shared/                         # 客户端 / 服务端共享代码
│   ├── src/                        # 5 个共享 TS 文件
│   │   ├── MessageTypes.ts
│   │   ├── DicePoolConfig.ts
│   │   ├── GachaPoolConfig.ts
│   │   ├── TowerConfig.ts
│   │   └── EnemyConfig.ts
│   ├── dist/
│   │   ├── esm/                    # 给 Cocos / 客户端 TS
│   │   └── cjs/                    # 给 Node 服务端
│   ├── package.json                # 双产物配置
│   └── README.md
│
├── RoguelikeClient/                # Cocos Creator 3.8 工程（客户端唯一源码）
│   ├── assets/scripts/             # 67 个 .ts 文件
│   │   ├── core/        (5)        # EventBus / TimeManager / GameRoot / Audio / Analytics
│   │   ├── utils/       (6)        # FixedPoint / SeededRandom / ObjectPool / Math / Logger / Storage
│   │   ├── config/      (7)        # 本地配置（数值在 @rtd/shared）
│   │   ├── map/         (3)        # MapGenerator / AStar / Heatmap
│   │   ├── entity/      (5)        # Tower / Enemy / Bullet / Minion / Crystal
│   │   ├── battle/     (15)        # BattleManager + 14 个 Controller
│   │   ├── roguelike/   (5)        # Dice / Gacha / Growth / Pick / RandomEvent
│   │   ├── data/        (4)        # User / Talent / Guide / FeatureUnlock
│   │   ├── social/      (8)        # Auth / Share / Room / Chat / Friend / Match / Coop / Spec
│   │   ├── network/     (5)        # NetworkClient / Online / WebSocket / Reconnect / Ping / FrameSync
│   │   └── ui/         (14)        # core(5) + widget(4) + hud(5) + index
│   ├── tsconfig.json               # Cocos 编辑器编译配置
│   ├── tsconfig.tools.json         # Node 测试编译配置
│   ├── tsconfig.check.json         # 类型检查（noEmit）
│   └── package.json
│
├── server/                         # Node.js 服务端（CommonJS，不变）
│   ├── src/                        # 22 个 .js
│   ├── test/run.js                 # 11 用例集成测试
│   └── package.json
│
├── tools/                          # 测试 & 工具
│   ├── sim.ts                      # 单机 sim
│   ├── sim_ui.ts                   # UI 冒烟
│   ├── online_sim.ts               # 联机端到端
│   ├── mock/cc.ts                  # Node 测试用的 Cocos Mock
│   └── codemod/convert.js          # CommonJS → ESM 转换（迁移完成已无用）
│
├── build-tools/                    # tools 编译产物（gitignore）
├── node_modules/                   # 含 @rtd/shared 软链
├── package.json                    # 工程根入口（构建+测试脚本）
│
├── 需求文档.md / 技术文档_*.md      # 原始设计
├── PROJECT_README.md               # 本文件
├── MIGRATION_CHECKLIST.md          # 迁移历史
└── 数据库设计文档.md
```

---

## 2. 一键验证

```bash
# 安装 + 构建 + 跑全套测试
npm install
npm test
```

预期输出：
```
=== sim done. final state=FINISHED wave=20 ===   # 或 wave=16+（5min 时限）
=== ALL UI TESTS PASSED ===
=== ALL TESTS PASSED ===                          # server test
```

---

## 3. 单项命令

```bash
# 构建 shared 双产物（修改 shared/ 后必跑）
npm run build:shared

# 编译 RoguelikeClient TS 到 build-tools/（修改 .ts 后必跑）
npm run build:tools

# 跑客户端类型检查（不编译）
npm run typecheck:client

# 单机模拟
npm run test:sim

# UI 冒烟
npm run test:sim_ui

# 联机端到端（自动启服 + 客户端跑战斗）
npm run test:online

# 服务端集成测试（11 用例）
npm run test:server

# 启动服务端（监听 8765）
npm run server:start
```

---

## 4. Cocos Creator 编辑器接入

1. 打开 Cocos Dashboard，**导入项目** → 选择 `RoguelikeApp/RoguelikeClient/`
2. 等待编辑器扫描 `assets/scripts/`（首次约 1-2 分钟）
3. 在 Hierarchy 创建主场景 `Main.scene`
4. 拖一个空 Node 进 Canvas，挂载新建脚本：

```typescript
import { _decorator, Component, Node } from 'cc';
import { instance as UIManager } from './ui/core/UIManager';
import { instance as GameRoot } from './core/GameRoot';
import { mountBattleHUD } from './ui';

const { ccclass, property } = _decorator;

@ccclass('Game')
export class Game extends Component {
    start(): void {
        UIManager.attachRoot(this.node);
        const battle = GameRoot.bootHeadless({
            seed: Date.now() | 0,
            difficulty: 2,
            players: [{ id: 'local', name: '玩家' }],
        });
        mountBattleHUD({ battle, playerId: 'local', online: false });
    }

    update(dt: number): void {
        // 由 Cocos 驱动 TimeManager
        const { instance: TimeManager } = require('./core/TimeManager');
        TimeManager.update(dt);
    }
}
```

5. 点 Play 按钮 → 在浏览器/模拟器中运行验证

---

## 5. 已实现的需求覆盖

### P0
| §F-... | 模块 | 实现位置 |
|-------|------|------|
| F-1.1 微信授权 | `social/AuthManager.ts` | ✅ |
| F-1.2 邀请 | `social/ShareManager.ts` | ✅ |
| F-1.3 房间 | `social/RoomManager.ts` + `server/src/room/` | ✅ |
| F-2.1 地图 | `map/MapGenerator.ts` | ✅ |
| F-2.2 8 种塔 | `entity/Tower.ts` + `@rtd/shared` | ✅ |
| F-2.3 12 怪 + 4 BOSS | `entity/Enemy.ts` + `@rtd/shared` | ✅ |
| F-2.4 经济 | `battle/EconomyManager.ts` | ✅ |
| F-2.5 水晶 | `entity/Crystal.ts` | ✅ |
| F-2.6 20 波 | `battle/WaveController.ts` | ✅ |
| F-3.1 骰子 | `roguelike/DiceSystem.ts` + `server/src/battle/DiceServer.js` | ✅ |
| F-3.2 塔成长 | `roguelike/TowerGrowthSystem.ts` | ✅ |
| F-3.3 抽卡 | `roguelike/GachaSystem.ts` + `server/src/battle/GachaServer.js` | ✅ |
| F-3.4 三选一 | `roguelike/TowerPickSystem.ts` | ✅ |
| F-3.5 Buff | `battle/BuffManager.ts` | ✅ |
| F-4.1-4.4 帧同步 | `network/*` + `server/src/battle/BattleSession.js` | ✅ |
| F-5.1 天赋树 | `data/TalentDataManager.ts` | ✅ |

### P1
| §F-... | 模块 | 实现位置 |
|-------|------|------|
| F-0.4 渐进解锁 | `data/FeatureUnlockManager.ts` | ✅ |
| F-0.5 FTUE 埋点 | `core/Analytics.ts` | ✅ |
| F-1.4 快速匹配 | `social/MatchmakingManager.ts` + `server/src/match/` | ✅ |
| F-1.5 好友 | `social/FriendManager.ts` | ✅ |
| F-1.6 聊天 | `social/ChatManager.ts` + `server/src/chat/` | ✅ |
| F-2.4.1 商店 | `battle/ShopController.ts` | ✅ |
| F-2.7 道具 | `battle/ItemController.ts` | ✅ |
| F-2.8 暂停 | `battle/PauseController.ts` | ✅ |
| F-2.9 音效 | `core/AudioManager.ts` | ✅ |
| F-3.6 随机事件 | `roguelike/RandomEventSystem.ts` | ✅ |
| F-4.5 协作 | `social/CooperationManager.ts` | ✅ |
| F-4.6 断线重连 + AI 托管 | `network/ReconnectHandler.ts` + `battle/AutoTowerAI.ts` | ✅ |
| F-4.7 观战 | `social/SpectatorManager.ts` | ✅ |

### 待 UI 同学完成（方案 A）
- MainMenu / Room / Battle / TalentTree / Leaderboard 等场景
- TowerOpPanel / DicePanel / GachaPanel / ShopPanel / SettlementPanel 等 Prefab

详见 `RoguelikeClient/assets/scripts/ui/README.md`（如有补充）。

---

## 6. 关键设计

- **确定性**：所有战斗用 `utils/SeededRandom`（Mulberry32），服务端骰子/抽卡用 `crypto.randomBytes`（防预测）
- **时间管理**：固定 15 FPS 逻辑帧 + 60 FPS 渲染插值
- **事件解耦**：全局 `EventBus`，UI/数据/埋点订阅
- **跨端**：`utils/Storage` 适配 wx.storage / localStorage / 内存
- **共享代码**：`@rtd/shared` 双产物，客户端服务端协议同步
- **联机权威**：服务端转发输入 + 真随机骰子/抽卡 + 状态哈希校验

---

## 7. 下一步

| 优先级 | 工作 | 责任方 |
|---|---|---|
| 高 | UI 场景搭建（方案 A） | UI 同学 |
| 高 | 美术 / 音频资源接入 | 美术外包 |
| 高 | 微信小程序 appid + 类目过审 | 产品 |
| 高 | Docker 化 + 部署 | DevOps |
| 中 | 数值平衡测试 | 策划 |
| 中 | 商业化（皮肤 / 通行证）— P3 已搁置 | 产品 |

---

## 8. 工时记录

- P0 核心玩法：约 5 天（67 个客户端文件 + 数值表）
- P1 功能扩展：约 3 天（商店 / 道具 / 事件 / 协作 / 联机适配）
- 服务端：约 3 天（22 个文件 + 11 用例集成测试）
- TypeScript 迁移：约 1 天（含 codemod + 全套验证）

总计代码量：**~90 个 TS/JS 源文件**（不含 dist 编译产物），约 12,000 行。
