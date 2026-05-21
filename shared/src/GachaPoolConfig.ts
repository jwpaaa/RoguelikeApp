/**
 * 客户端 / 服务端共享：抽卡池配置
 * ---------------------------------------------------------------
 * - N/R/SR/SSR 概率：55/30/12/3
 * - 保底：连续 4 抽未出 SR → 第 5 抽必出；连续 14 抽未出 SSR → 第 15 抽必出
 * - 重复 unique 卡 → 转换为金币补偿：N=30/R=80/SR=200/SSR=500
 */

import { Duration, DurationValue } from './DicePoolConfig.js';

export const Rarity = {
    N:   'N',
    R:   'R',
    SR:  'SR',
    SSR: 'SSR',
} as const;

export type RarityValue = typeof Rarity[keyof typeof Rarity];

export const RarityRate: Record<RarityValue, number> = Object.freeze({
    N:   0.55,
    R:   0.30,
    SR:  0.12,
    SSR: 0.03,
});

export const PityRule = Object.freeze({
    SR_PITY:  5,    // 连续 4 抽未出 SR → 第 5 抽必出
    SSR_PITY: 15,   // 连续 14 抽未出 SSR → 第 15 抽必出
});

export const DUPLICATE_REFUND: Record<RarityValue, number> = Object.freeze({
    N:   30,
    R:   80,
    SR:  200,
    SSR: 500,
});

/** 复合效果值（SR-01 / SR-03 / SR-04 / SSR-04 / SSR-05 等用）*/
export type ComplexEffectValue =
    | { crit: number; critDmg: number }
    | { hp: number; every: number; heal: number }
    | { spd: number; cost: number }
    | { shield: number; every: number; add: number }
    | { duration: number };

export interface GachaCard {
    id: string;
    rarity: RarityValue;
    name: string;
    desc: string;
    duration: DurationValue;
    unique?: boolean;
    effect: {
        target: string;
        kind: string;
        value: number | ComplexEffectValue;
    };
}

export const CardPoolN: readonly GachaCard[] = Object.freeze([
    { id: 'N-01', rarity: Rarity.N, name: '金币袋',   desc: '立即获得 50 金币',           duration: Duration.INSTANT,   effect: { target: 'ECONOMY',     kind: 'GOLD_ADD', value: 50 } },
    { id: 'N-02', rarity: Rarity.N, name: '小额强化', desc: '随机 1 个塔攻击 +10% 永久',   duration: Duration.PERMANENT, effect: { target: 'RANDOM_TOWER', kind: 'ATK_PCT',  value: 0.10 } },
    { id: 'N-03', rarity: Rarity.N, name: '维修工具', desc: '水晶恢复 1 点生命',           duration: Duration.INSTANT,   effect: { target: 'CRYSTAL',     kind: 'HEAL',     value: 1 } },
    { id: 'N-04', rarity: Rarity.N, name: '加速券',   desc: '下波怪物移速 -10%',           duration: Duration.ONE_WAVE,  effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'SPEED_PCT', value: -0.10 } },
]);

export const CardPoolR: readonly GachaCard[] = Object.freeze([
    { id: 'R-01', rarity: Rarity.R, name: '塔解锁·随机', desc: '随机解锁 1 种未拥有的塔', duration: Duration.PERMANENT, effect: { target: 'TOWER_UNLOCK', kind: 'UNLOCK_RANDOM', value: 1 } },
    { id: 'R-02', rarity: Rarity.R, name: '塔强化券',     desc: '选 1 塔升至 Lv.2',         duration: Duration.INSTANT,   effect: { target: 'CHOSEN_TOWER', kind: 'UPGRADE_TO', value: 2 } },
    { id: 'R-03', rarity: Rarity.R, name: '属性爆发',     desc: '攻击 +15%、攻速 +15% 永久', duration: Duration.PERMANENT, effect: { target: 'SELF_TOWERS', kind: 'ATK_AND_SPD', value: 0.15 } },
    { id: 'R-04', rarity: Rarity.R, name: '金币加成',     desc: '每波金币 +30% 永久',         duration: Duration.PERMANENT, effect: { target: 'ECONOMY', kind: 'WAVE_REWARD_PCT', value: 0.30 } },
]);

export const CardPoolSR: readonly GachaCard[] = Object.freeze([
    { id: 'SR-01', rarity: Rarity.SR, name: '远古遗物·暴击', desc: '暴击 +20%、暴伤 +50%',     duration: Duration.PERMANENT, unique: true, effect: { target: 'SELF_TOWERS', kind: 'CRIT_AND_DMG', value: { crit: 0.20, critDmg: 0.50 } } },
    { id: 'SR-02', rarity: Rarity.SR, name: '远古遗物·财宝', desc: '每波结束 +150 金币',       duration: Duration.PERMANENT, unique: true, effect: { target: 'ECONOMY',     kind: 'WAVE_BONUS_GOLD', value: 150 } },
    { id: 'SR-03', rarity: Rarity.SR, name: '远古遗物·壁垒', desc: '水晶最大 +3、每 5 波回 1', duration: Duration.PERMANENT, unique: true, effect: { target: 'CRYSTAL',     kind: 'HP_AND_REGEN',    value: { hp: 3, every: 5, heal: 1 } } },
    { id: 'SR-04', rarity: Rarity.SR, name: '远古遗物·急速', desc: '攻速 +30%、建造 -20%',      duration: Duration.PERMANENT, unique: true, effect: { target: 'SELF_TOWERS', kind: 'SPD_AND_COST',    value: { spd: 0.30, cost: -0.20 } } },
    { id: 'SR-05', rarity: Rarity.SR, name: '骰子操控',       desc: '下次掷骰可重掷 1 次',     duration: Duration.PERMANENT, unique: true, effect: { target: 'PLAYER',      kind: 'DICE_REROLL',     value: 1 } },
]);

export const CardPoolSSR: readonly GachaCard[] = Object.freeze([
    { id: 'SSR-01', rarity: Rarity.SSR, name: '命运之眼',  desc: '掷骰可见三池并自选',         duration: Duration.PERMANENT, unique: true, effect: { target: 'PLAYER',      kind: 'DICE_FORESIGHT', value: 1 } },
    { id: 'SSR-02', rarity: Rarity.SSR, name: '时间加速',  desc: '所有塔攻速翻倍',             duration: Duration.PERMANENT, unique: true, effect: { target: 'SELF_TOWERS', kind: 'SPD_PCT',        value: 1.00 } },
    { id: 'SSR-03', rarity: Rarity.SSR, name: '即死诅咒',  desc: '攻击 5% 几率秒杀非 BOSS',     duration: Duration.PERMANENT, unique: true, effect: { target: 'SELF_TOWERS', kind: 'INSTAKILL_PCT',  value: 0.05 } },
    { id: 'SSR-04', rarity: Rarity.SSR, name: '不朽水晶',  desc: '5 层护盾 + 每 5 波补 1 层',   duration: Duration.PERMANENT, unique: true, effect: { target: 'CRYSTAL',     kind: 'SHIELD_AND_REGEN', value: { shield: 5, every: 5, add: 1 } } },
    { id: 'SSR-05', rarity: Rarity.SSR, name: '黄金时代',  desc: '金币翻倍 + 建造减半，3 波',  duration: Duration.ONE_WAVE,  effect: { target: 'PLAYER',      kind: 'GOLDEN_AGE',     value: { duration: 3 } } },
]);

/** SR/SSR 全部视为遗物（永久 Buff） */
export const RelicIds: ReadonlySet<string> = new Set([
    ...CardPoolSR.map((c) => c.id),
    ...CardPoolSSR.map((c) => c.id),
]);
