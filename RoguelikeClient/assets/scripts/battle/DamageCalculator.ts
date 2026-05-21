/**
 * 伤害计算（来自需求文档 §5.0）
 * ---------------------------------------------------------------
 *   物理伤害 = 攻击力 × (1 - 护甲 / (护甲 + 100))
 *   魔法伤害 = 攻击力 × (1 - 魔抗 / (魔抗 + 100))
 *   真实伤害 = 攻击力（不受减免）
 *
 *   暴击伤害 = 基础 × 暴击倍率（默认 1.5×）
 *   最终伤害 = 基础 × 暴击系数 × 随机浮动 (0.95~1.05)
 *
 * 注：Enemy.takeDamage 已自带护甲/易伤计算，因此本模块仅负责
 *     "塔的输出端" — 计算暴击与浮动后的 rawDmg。
 */

import type { SeededRandom } from '../utils/SeededRandom';

export interface OutgoingArgs {
    atk: number;
    critRate: number;
    critDmg: number;
    rng: SeededRandom;
}

export interface OutgoingResult {
    raw: number;
    crit: boolean;
}

export class DamageCalculator {
    static computeOutgoing({ atk, critRate, critDmg, rng }: OutgoingArgs): OutgoingResult {
        const crit = rng.next() < critRate;
        const variance = 0.95 + rng.next() * 0.10;
        const raw = atk * (crit ? critDmg : 1) * variance;
        return { raw, crit };
    }

    /** 连锁伤害递减：第 n 跳（0-based）= raw × (1 - decay)^n */
    static chainDamage(raw: number, decay: number, jump: number): number {
        return raw * Math.pow(1 - decay, jump);
    }
}
