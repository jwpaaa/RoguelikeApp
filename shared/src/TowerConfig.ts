/**
 * 客户端 / 服务端共享：防御塔配置
 * ---------------------------------------------------------------
 * 8 种塔 × 3 级，含基础属性、特殊效果、每波成长曲线。
 * 数值采用浮点表示便于阅读；运行期由战斗逻辑转 FixedPoint 计算。
 */

export const TowerType = {
    ARROW:   'ARROW',
    CANNON:  'CANNON',
    ICE:     'ICE',
    MAGIC:   'MAGIC',
    POISON:  'POISON',
    TESLA:   'TESLA',
    TOTEM:   'TOTEM',
    SUMMON:  'SUMMON',
} as const;

export type TowerTypeValue = typeof TowerType[keyof typeof TowerType];

export const DamageType = {
    PHYSICAL: 'PHYSICAL',
    MAGIC:    'MAGIC',
    TRUE:     'TRUE',
} as const;

export type DamageTypeValue = typeof DamageType[keyof typeof DamageType];

export const TargetMode = {
    FIRST:  'FIRST',
    LAST:   'LAST',
    STRONG: 'STRONG',
    WEAK:   'WEAK',
    CLOSE:  'CLOSE',
} as const;

export type TargetModeValue = typeof TargetMode[keyof typeof TargetMode];

/** 单级塔属性 */
export interface TowerLevelStats {
    atk?: number;
    atkSpeed?: number;
    range?: number;
    splash?: number;
    slow?: number;
    slowDur?: number;
    pierce?: number;
    dot?: number;
    dotDur?: number;
    maxStack?: number;
    chain?: number;
    chainDecay?: number;
    auraAtk?: number;
    auraSpd?: number;
    auraRange?: number;
    minionHp?: number;
    minionAtk?: number;
    minionMax?: number;
    summonInterval?: number;
    cost: number;
    special?: string;
    detectStealth?: boolean;
}

export interface TowerDef {
    name: string;
    dmgType: DamageTypeValue;
    levels: TowerLevelStats[];
    growth: {
        perWave: Record<string, number>;
        everyN: { n: number; attrs: Record<string, number> };
    };
}

export const TowerConfig: Record<TowerTypeValue, TowerDef> = {
    [TowerType.ARROW]: {
        name: '箭塔',
        dmgType: DamageType.PHYSICAL,
        levels: [
            { atk: 25, atkSpeed: 1.0, range: 3.0, cost: 100 },
            { atk: 35, atkSpeed: 0.9, range: 4.0, cost: 150 },
            { atk: 45, atkSpeed: 0.8, range: 4.0, cost: 250, special: '20%几率双重射击' },
        ],
        growth: { perWave: { atk: 3 }, everyN: { n: 3, attrs: { atkSpeed: -0.05 } } },
    },
    [TowerType.CANNON]: {
        name: '炮塔',
        dmgType: DamageType.PHYSICAL,
        levels: [
            { atk: 40, atkSpeed: 2.5, range: 2.5, splash: 1.0, cost: 120 },
            { atk: 60, atkSpeed: 2.2, range: 3.0, splash: 1.5, cost: 180 },
            { atk: 80, atkSpeed: 2.0, range: 3.0, splash: 2.0, cost: 300, special: '溅射附带0.8s眩晕' },
        ],
        growth: { perWave: { atk: 5 }, everyN: { n: 3, attrs: { splash: 0.1 } } },
    },
    [TowerType.ICE]: {
        name: '冰塔',
        dmgType: DamageType.MAGIC,
        levels: [
            { atk: 10, atkSpeed: 1.5, range: 3.0, slow: 0.30, slowDur: 2.0, cost: 80 },
            { atk: 14, atkSpeed: 1.3, range: 3.5, slow: 0.50, slowDur: 2.5, cost: 120 },
            { atk: 18, atkSpeed: 1.2, range: 3.5, slow: 0.60, slowDur: 3.0, cost: 200, special: '15%几率冰冻1.5s' },
        ],
        growth: { perWave: { slow: 0.02 }, everyN: { n: 3, attrs: { slowDur: 0.1 } } },
    },
    [TowerType.MAGIC]: {
        name: '魔法塔',
        dmgType: DamageType.MAGIC,
        levels: [
            { atk: 20, atkSpeed: 1.8, range: 3.0, pierce: 3, cost: 110 },
            { atk: 29, atkSpeed: 1.6, range: 3.0, pierce: 5, cost: 160, detectStealth: true },
            { atk: 38, atkSpeed: 1.5, range: 3.5, pierce: 7, cost: 260, detectStealth: true, special: '对护盾额外200%伤害' },
        ],
        growth: { perWave: { atk: 2.5 }, everyN: { n: 3, attrs: { pierce: 1 } } },
    },
    [TowerType.POISON]: {
        name: '毒塔',
        dmgType: DamageType.PHYSICAL,
        levels: [
            { atk: 8,  atkSpeed: 1.2, range: 2.5, dot: 4,  dotDur: 3.0, maxStack: 5,  cost: 90 },
            { atk: 12, atkSpeed: 1.0, range: 3.0, dot: 7,  dotDur: 5.0, maxStack: 8,  cost: 140 },
            { atk: 16, atkSpeed: 0.9, range: 3.0, dot: 10, dotDur: 5.0, maxStack: 10, cost: 230, special: '叠满时触发范围毒爆' },
        ],
        growth: { perWave: { dot: 1 }, everyN: { n: 3, attrs: { maxStack: 1 } } },
    },
    [TowerType.TESLA]: {
        name: '电塔',
        dmgType: DamageType.MAGIC,
        levels: [
            { atk: 18, atkSpeed: 2.0, range: 2.5, chain: 3, chainDecay: 0.20, cost: 105 },
            { atk: 25, atkSpeed: 1.8, range: 3.0, chain: 5, chainDecay: 0.15, cost: 160 },
            { atk: 35, atkSpeed: 1.6, range: 3.0, chain: 7, chainDecay: 0.10, cost: 260, detectStealth: true, special: '连锁目标麻痹0.5s' },
        ],
        growth: { perWave: { atk: 2 }, everyN: { n: 3, attrs: { chain: 1 } } },
    },
    [TowerType.TOTEM]: {
        name: '图腾塔',
        dmgType: DamageType.PHYSICAL,
        levels: [
            { auraAtk: 0.15, auraSpd: 0.10, auraRange: 2.0, cost: 100 },
            { auraAtk: 0.25, auraSpd: 0.18, auraRange: 2.5, cost: 150, special: '塔射程+0.5' },
            { auraAtk: 0.35, auraSpd: 0.25, auraRange: 3.0, cost: 250, special: '暴击率+10%' },
        ],
        growth: { perWave: { auraAtk: 0.005 }, everyN: { n: 2, attrs: { auraRange: 0.1 } } },
    },
    [TowerType.SUMMON]: {
        name: '召唤塔',
        dmgType: DamageType.PHYSICAL,
        levels: [
            { minionHp: 50,  minionAtk: 5,  minionMax: 3, summonInterval: 6.0, cost: 130 },
            { minionHp: 100, minionAtk: 10, minionMax: 5, summonInterval: 5.0, cost: 200, special: '小兵嘲讽' },
            { minionHp: 160, minionAtk: 18, minionMax: 7, summonInterval: 4.0, cost: 320, special: '小兵死亡自爆' },
        ],
        growth: { perWave: { minionHp: 8 }, everyN: { n: 3, attrs: { minionAtk: 2 } } },
    },
};

/** 计算 Lv.N 累计建造成本（含升级费） */
export function getCumulativeCost(towerType: TowerTypeValue, level: number): number {
    const cfg = TowerConfig[towerType];
    if (!cfg) return 0;
    let sum = 0;
    for (let i = 0; i < Math.min(level, cfg.levels.length); i++) sum += cfg.levels[i].cost;
    return sum;
}

/** 出售返还（实际累计花费 × 50%） */
export function getSellReturn(towerType: TowerTypeValue, level: number): number {
    return Math.floor(getCumulativeCost(towerType, level) * 0.5);
}
