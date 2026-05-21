/**
 * Cocos API 适配层（双模式）
 * ---------------------------------------------------------------
 * Cocos 真实环境：直接 import { Node, Label, ... } from 'cc'
 * Node 测试环境：从 tools/mock/cc.ts 注入 mock 实现
 *
 * TS 在 tsconfig.json 中通过 paths 把 'cc' 映射到正确位置：
 *   - 主配置（编辑器）：paths.cc = ['./node_modules/cc']
 *   - 测试配置：paths.cc = ['../tools/mock/cc.ts']
 *
 * 这样我们的 UI 代码 import { Node, ... } from 'cc' 在两种环境下都能工作。
 */

import * as cc from 'cc';

/** 是否运行在真实 Cocos 引擎中（运行时检测） */
export const isReal: boolean = typeof (cc as any).director !== 'undefined' && !(cc as any)._MOCK;

export { cc };
