# Cocos Creator 迁移 Checklist

> 目标：把 67 个 `.js` 源文件迁移到 `RoguelikeClient/assets/scripts/*.ts`，废弃 `module-loader.js`。
>
> **建议**：按顺序按层级迁移，每层完成后立即跑 `npm run typecheck` 验证。

---

## 阶段 0：准备（已完成 ✅）

- [x] `shared/` 抽离 5 个共享配置（MessageTypes/DicePool/GachaPool/Tower/Enemy）
- [x] `shared/` 双产物构建通过（dist/esm + dist/cjs）
- [x] `RoguelikeClient/tsconfig.json`（Cocos 编辑器用）
- [x] `RoguelikeClient/tsconfig.tools.json`（Node 测试用）
- [x] `RoguelikeClient/package.json`（含 build/test 脚本）
- [x] `tools/codemod/convert.js` codemod 工具
- [x] 示例：`RoguelikeClient/assets/scripts/utils/FixedPoint.ts`（含完整类型）

---

## 阶段 1：utils 层（最底层，无依赖）

按顺序逐个迁移、跑 typecheck：

### 1.1 跑 codemod 自动转换
```bash
cd RoguelikeApp
node tools/codemod/convert.js assets/scripts/utils/SeededRandom.js
node tools/codemod/convert.js assets/scripts/utils/ObjectPool.js
node tools/codemod/convert.js assets/scripts/utils/MathUtils.js
node tools/codemod/convert.js assets/scripts/utils/Logger.js
node tools/codemod/convert.js assets/scripts/utils/Storage.js
```

### 1.2 手工补类型注解
对每个 `.ts` 文件：把 JSDoc 类型转为 TS 函数签名（参考 `FixedPoint.ts` 的写法）。

- [ ] `utils/FixedPoint.ts`  ✅ 已示范
- [ ] `utils/SeededRandom.ts`  （函数参数加 `: number`）
- [ ] `utils/ObjectPool.ts`  （需加泛型 `<T>`）
- [ ] `utils/MathUtils.ts`  （纯函数集，加 `: number`）
- [ ] `utils/Logger.ts`  （加 `tag: string, ...args: unknown[]`）
- [ ] `utils/Storage.ts`  （注意：内含 `if (typeof wx !== 'undefined')`，需声明 `declare const wx: any;`）

### 1.3 typecheck
```bash
cd RoguelikeClient
npm run typecheck
```

---

## 阶段 2：core + entity 层

### 2.1 codemod
```bash
node tools/codemod/convert.js assets/scripts/core/EventBus.js
node tools/codemod/convert.js assets/scripts/core/TimeManager.js
node tools/codemod/convert.js assets/scripts/core/Analytics.js
node tools/codemod/convert.js assets/scripts/core/AudioManager.js
node tools/codemod/convert.js assets/scripts/core/GameRoot.js
node tools/codemod/convert.js assets/scripts/entity/Tower.js
node tools/codemod/convert.js assets/scripts/entity/Enemy.js
node tools/codemod/convert.js assets/scripts/entity/Bullet.js
node tools/codemod/convert.js assets/scripts/entity/Minion.js
node tools/codemod/convert.js assets/scripts/entity/Crystal.js
```

### 2.2 处理 config（非 shared 部分）
```bash
# 已抽到 shared 的不需要迁移：DicePool/GachaPool/Tower/Enemy
# 仅迁移本地配置：
node tools/codemod/convert.js assets/scripts/config/MapConfig.js
node tools/codemod/convert.js assets/scripts/config/WaveConfig.js
node tools/codemod/convert.js assets/scripts/config/DifficultyConfig.js
node tools/codemod/convert.js assets/scripts/config/TalentConfig.js
node tools/codemod/convert.js assets/scripts/config/ItemConfig.js
node tools/codemod/convert.js assets/scripts/config/ShopConfig.js
node tools/codemod/convert.js assets/scripts/config/RandomEventConfig.js
```

**注意**：原 `config/TowerConfig.js` `EnemyConfig.js` `DicePoolConfig.js` `GachaPoolConfig.js` 已被 `@rtd/shared` 取代，**不要再迁移**。codemod 已自动把 `require('../config/TowerConfig')` 改写为 `import ... from '@rtd/shared'`。

### 2.3 手工补类型
- [ ] `core/EventBus.ts`  （`Map<string, Function[]>` → `Map<string, ((...args: unknown[]) => void)[]>`）
- [ ] `core/TimeManager.ts`
- [ ] `core/Analytics.ts`
- [ ] `core/AudioManager.ts`
- [ ] `core/GameRoot.ts`  ⚠️ 引用大量其他模块，循环依赖风险
- [ ] `entity/Tower.ts`  ⚠️ 字段最多的一个，约 20 个属性
- [ ] `entity/Enemy.ts`  ⚠️ 字段多
- [ ] `entity/Bullet.ts` `Minion.ts` `Crystal.ts`  （简单）

---

## 阶段 3：battle 层（核心）

### 3.1 codemod
```bash
node tools/codemod/convert.js assets/scripts/battle/EntityManager.js
node tools/codemod/convert.js assets/scripts/battle/DamageCalculator.js
node tools/codemod/convert.js assets/scripts/battle/EconomyManager.js
node tools/codemod/convert.js assets/scripts/battle/BuffManager.js
node tools/codemod/convert.js assets/scripts/battle/TowerController.js
node tools/codemod/convert.js assets/scripts/battle/TowerAI.js
node tools/codemod/convert.js assets/scripts/battle/EnemyController.js
node tools/codemod/convert.js assets/scripts/battle/BulletController.js
node tools/codemod/convert.js assets/scripts/battle/WaveController.js
node tools/codemod/convert.js assets/scripts/battle/ItemController.js
node tools/codemod/convert.js assets/scripts/battle/ShopController.js
node tools/codemod/convert.js assets/scripts/battle/PauseController.js
node tools/codemod/convert.js assets/scripts/battle/DamagePopupManager.js
node tools/codemod/convert.js assets/scripts/battle/AutoTowerAI.js
node tools/codemod/convert.js assets/scripts/battle/BattleManager.js
```

### 3.2 手工补类型 + 处理循环依赖
- [ ] `battle/EntityManager.ts`
- [ ] `battle/DamageCalculator.ts`
- [ ] `battle/EconomyManager.ts`
- [ ] `battle/BuffManager.ts`  ⚠️ effect 类型复杂
- [ ] `battle/TowerController.ts`
- [ ] `battle/TowerAI.ts`
- [ ] `battle/EnemyController.ts`  ⚠️ 内部 `require('../entity/Enemy')` 是循环依赖，需用 `import type`
- [ ] `battle/BulletController.ts`
- [ ] `battle/WaveController.ts`
- [ ] `battle/ItemController.ts`  ⚠️ 内部 `require('../widget/Toast')` 改 lazy import
- [ ] `battle/ShopController.ts`
- [ ] `battle/PauseController.ts`  ⚠️ 内部 `require('../core/TimeManager')` 注意
- [ ] `battle/DamagePopupManager.ts`
- [ ] `battle/AutoTowerAI.ts`
- [ ] `battle/BattleManager.ts`  🔴 最大文件（约 380 行），约 15 个 import，仔细处理

---

## 阶段 4：roguelike + map + data + social + network

### 4.1 codemod
```bash
node tools/codemod/convert.js assets/scripts/roguelike/DiceSystem.js
node tools/codemod/convert.js assets/scripts/roguelike/GachaSystem.js
node tools/codemod/convert.js assets/scripts/roguelike/TowerGrowthSystem.js
node tools/codemod/convert.js assets/scripts/roguelike/TowerPickSystem.js
node tools/codemod/convert.js assets/scripts/roguelike/RandomEventSystem.js

node tools/codemod/convert.js assets/scripts/map/MapGenerator.js
node tools/codemod/convert.js assets/scripts/map/AStarPathfinding.js
node tools/codemod/convert.js assets/scripts/map/HeatmapRenderer.js

node tools/codemod/convert.js assets/scripts/data/UserDataManager.js
node tools/codemod/convert.js assets/scripts/data/TalentDataManager.js
node tools/codemod/convert.js assets/scripts/data/GuideDataManager.js
node tools/codemod/convert.js assets/scripts/data/FeatureUnlockManager.js

node tools/codemod/convert.js assets/scripts/social/AuthManager.js
node tools/codemod/convert.js assets/scripts/social/ShareManager.js
node tools/codemod/convert.js assets/scripts/social/RoomManager.js
node tools/codemod/convert.js assets/scripts/social/ChatManager.js
node tools/codemod/convert.js assets/scripts/social/FriendManager.js
node tools/codemod/convert.js assets/scripts/social/MatchmakingManager.js
node tools/codemod/convert.js assets/scripts/social/CooperationManager.js
node tools/codemod/convert.js assets/scripts/social/SpectatorManager.js

node tools/codemod/convert.js assets/scripts/network/WebSocketClient.js
node tools/codemod/convert.js assets/scripts/network/MessageProtocol.js  # 注意：本文件已替换为 @rtd/shared，可删除
node tools/codemod/convert.js assets/scripts/network/NetworkClient.js
node tools/codemod/convert.js assets/scripts/network/OnlineBattleAdapter.js
node tools/codemod/convert.js assets/scripts/network/FrameSyncManager.js
node tools/codemod/convert.js assets/scripts/network/ReconnectHandler.js
node tools/codemod/convert.js assets/scripts/network/PingMonitor.js
```

### 4.2 手工补类型
（按需）

---

## 阶段 5：ui 层

### 5.1 codemod
```bash
node tools/codemod/convert.js assets/scripts/ui/core/UIConst.js
node tools/codemod/convert.js assets/scripts/ui/core/CocosAdapter.js
node tools/codemod/convert.js assets/scripts/ui/core/UINode.js
node tools/codemod/convert.js assets/scripts/ui/core/UIManager.js
node tools/codemod/convert.js assets/scripts/ui/core/UIBase.js

node tools/codemod/convert.js assets/scripts/ui/widget/Toast.js
node tools/codemod/convert.js assets/scripts/ui/widget/Dialog.js
node tools/codemod/convert.js assets/scripts/ui/widget/LoadingMask.js
node tools/codemod/convert.js assets/scripts/ui/widget/DamagePopup.js

node tools/codemod/convert.js assets/scripts/ui/hud/TopBar.js
node tools/codemod/convert.js assets/scripts/ui/hud/BuffBar.js
node tools/codemod/convert.js assets/scripts/ui/hud/ItemBar.js
node tools/codemod/convert.js assets/scripts/ui/hud/PingIndicator.js
node tools/codemod/convert.js assets/scripts/ui/hud/PauseMenu.js

node tools/codemod/convert.js assets/scripts/ui/index.js
```

### 5.2 手工调整
- [ ] `ui/core/CocosAdapter.ts`：原文件用 `try { require('cc') }` 做条件加载，TS 需改为 `import type { Node as CCNode } from 'cc';` 并用静态 mock
- [ ] 其它 ui 文件类型注解

---

## 阶段 6：tools 测试

### 6.1 改 tools/*.ts
- [ ] `tools/sim.ts`  （改 `require` 为 `import`，但走 CommonJS 输出仍用 require）
- [ ] `tools/online_sim.ts`
- [ ] `tools/sim_ui.ts`

### 6.2 跑测试
```bash
cd RoguelikeClient
npm run test:sim          # 单机
npm run test:sim_ui       # UI
npm run test:online       # 联机
```

---

## 阶段 7：循环依赖修复

ESM 比 CommonJS 严格，下列模块可能有循环依赖告警：

| 模块 A | 模块 B | 解决方式 |
|--------|--------|---------|
| `BattleManager` | `BuffManager` `TowerController` `WaveController` 等 | 全部用 `import type` 引入类型；运行时用 lazy init |
| `EnemyController` | `Enemy`（内部 require '../entity/Enemy'） | 提到顶部 import |
| `RoomManager` ↔ `ShareManager` | （目前是 lazy require） | 保留 lazy 模式或改 lazy ESM dynamic import |
| `ItemController` ↔ `Toast` | 同上 | 同上 |

---

## 阶段 8：Cocos 内验证

### 8.1 准备 Cocos 工程
1. 用 Cocos Dashboard 创建工程 `RoguelikeClient`
2. 选 2D-Empty 模板
3. 把现有 `RoguelikeClient/assets/scripts/` 整体放入工程
4. 在 Cocos 编辑器内打开
5. 等编辑器生成 `temp/tsconfig.cocos.json`（首次启动会自动产生）

### 8.2 编辑器内运行
- 创建一个空主场景 `Main.scene`
- 拖一个空 Node 进 Canvas
- 给 Node 挂一个新建组件（参考 `GameRoot.bootHeadless` 写一个最小启动脚本）
- 点 Play 按钮 → 浏览器中验证战斗逻辑

---

## 阶段 9：收尾

- [ ] 删除根目录 `assets/scripts/`
- [ ] 删除 `module-loader.js`
- [ ] 删除 `package.json`（根目录的，旧版）
- [ ] 更新 `PROJECT_README.md`
- [ ] Git commit + tag `v1.0-cocos-migrated`

---

## 风险与避坑

### ⚠️ 常见坑

| 坑 | 解决 |
|----|------|
| **ESM 必须带 .js 后缀** | codemod 已自动加 `.js` 后缀，但要注意 import 写法 `from './X.js'`（不是 `./X.ts`） |
| **import type 与 import** | TS 类型引用用 `import type`，避免被打包到运行时 |
| **`Object.freeze` + readonly** | TS 严格模式下 readonly 数组需手工标 `as const` |
| **JSDoc `@type {X|Y}` 字面量** | TS 推断更严格，复合 value 改用 union type |
| **`process.env`** | Cocos 不支持，改用 Cocos 自带 `sys.localStorage` 或编译期注入 |
| **`crypto.randomBytes`** | 客户端无；保持服务端独有 |
| **`require('cc')` 测试环境** | Node 端用 `tools/mock/cc.ts` mock |

### ⚠️ Cocos 编辑器特殊

- Cocos 会自动扫描 `assets/` 下所有 `.ts` 文件并为每个生成一个 `.meta` 文件
- **不要** 把 `.ts` 放在 `assets/` 之外的位置（如 `RoguelikeClient/scripts/`），Cocos 不识别
- 编辑器打开后第一次扫描可能要 1-2 分钟，期间不要操作

### ⚠️ 测试隔离

- Node 测试用 `tsconfig.tools.json` 编译到 `build-tools/`
- Cocos 编辑器用 `tsconfig.json` 直接读 TS 源码
- 两者不要互相干扰
- **任何修改先跑 `npm run typecheck`**，再跑 sim

---

## 工时预估（重申）

| 阶段 | 工作日 |
|------|:---:|
| 0. 准备（**已完成**） | 0.5 |
| 1. utils 层 | 1 |
| 2. core + entity + config | 1.5 |
| 3. battle 层 | 2.5 |
| 4. roguelike + map + data + social + network | 2 |
| 5. ui 层 | 1 |
| 6. tools 测试 | 1 |
| 7. 循环依赖修复 | 0.5 |
| 8. Cocos 内验证 | 1 |
| 9. 收尾 | 0.5 |
| **合计** | **11.5** |

实际进度按团队 TS 熟练度上下浮动。

---

## 自查清单（每阶段结束）

- [ ] `cd RoguelikeClient && npm run typecheck` 零错误
- [ ] `cd RoguelikeClient && npm run test:sim` 全绿
- [ ] `cd ../server && npm test` 全绿（确保 shared 变化没破坏服务端）
- [ ] Git commit message 含 "[migrate] 阶段 X：YYY 完成"
