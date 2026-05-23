/**
 * @rtd/shared 入口
 * ---------------------------------------------------------------
 * 客户端通过 ESM 直接 import：
 *   import { MessageType, TowerConfig } from '@rtd/shared';
 * 服务端通过 CommonJS：
 *   const { MessageType, TowerConfig } = require('@rtd/shared');
 *
 * 任何修改这些文件的 PR 都必须同时跑客户端 + 服务端测试。
 */

export * from './MessageTypes';
export * from './DicePoolConfig';
export * from './GachaPoolConfig';
export * from './TowerConfig';
export * from './EnemyConfig';
