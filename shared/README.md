# @rtd/shared — 客户端 / 服务端共享代码

> 协议常量 + 数值配置的**唯一权威源**。任何修改都会同步影响两端。

## 包含模块

| 文件 | 说明 |
|------|------|
| `MessageTypes.ts` | WebSocket 消息类型 / 玩家操作类型 / 错误码 |
| `DicePoolConfig.ts` | 骰子四池（31 个效果）+ 抽取规则 |
| `GachaPoolConfig.ts` | 抽卡四池（N/R/SR/SSR）+ 保底规则 |
| `TowerConfig.ts` | 8 种塔 × 3 级 + 成长曲线 |
| `EnemyConfig.ts` | 12 种怪 + 4 BOSS + HP 公式 |

## 双产物构建

```bash
cd shared
npm install            # 装 typescript + rimraf
npm run build          # 同时输出 dist/esm（给 Cocos）+ dist/cjs（给 Node）
```

产出结构：
```
dist/
├── esm/                # ES Module（客户端 / Cocos）
│   ├── index.js
│   ├── index.d.ts
│   └── ...
└── cjs/                # CommonJS（服务端）
    ├── index.js
    └── ...
```

## 客户端使用

```typescript
// RoguelikeClient/assets/scripts/network/NetworkClient.ts
import { MessageType, type WsMessage } from '@rtd/shared';

class NetworkClient {
    async login(code: string) {
        const rsp = await this.ws.send(MessageType.AUTH_LOGIN, { code });
    }
}
```

通过 `tsconfig.json` 的 `paths` 映射：
```json
{
  "compilerOptions": {
    "paths": {
      "@rtd/shared": ["../../shared/dist/esm/index.js"],
      "@rtd/shared/*": ["../../shared/dist/esm/*"]
    }
  }
}
```

## 服务端使用

```javascript
// server/src/index.js
const { MessageType, TowerConfig, DicePoolConfig } = require('@rtd/shared');
```

通过 `server/package.json` 的本地依赖：
```json
{
  "dependencies": {
    "@rtd/shared": "file:../shared"
  }
}
```

并在 server 目录执行：
```bash
cd server
npm install            # 会通过 file: 协议安装 shared
```

## 关键约定

1. **不放运行时逻辑** — 只有常量、纯函数（如 `computeHp`、`getCumulativeCost`）和类型
2. **不依赖任何运行时 API** — 不引 `cc.*`、不引 `process.*`、不引 `wx.*`
3. **修改流程** — 任何修改必须：
   - 跑 `npm run build`
   - 跑客户端 sim
   - 跑服务端 test
   - 跑 online_sim
4. **新增字段** — 必须做向后兼容（旧客户端能忽略未知字段）
