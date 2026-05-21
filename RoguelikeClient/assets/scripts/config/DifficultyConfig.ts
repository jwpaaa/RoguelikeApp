/**
 * 难度配置（来自需求文档 §3.4 + §3.5）
 */

export const Difficulty = Object.freeze({
    EASY:   1,
    NORMAL: 2,
    HARD:   3,
});

export type DifficultyValue = typeof Difficulty[keyof typeof Difficulty];

export interface DifficultyDef {
    name: string;
    enemyHpMul: number;
    enemySpeedMul: number;
    startGold: number;
    crystalHp: number;
    waveRewardMul: number;
    diceGoodChance: number;
    expMul: number;
    bossExtraSkill: number;
    dicePoolReduce: boolean;
}

export const DifficultyConfig: Record<DifficultyValue, DifficultyDef> = Object.freeze({
    [Difficulty.EASY]: {
        name: '简单',
        enemyHpMul: 0.8, enemySpeedMul: 0.9, startGold: 250, crystalHp: 7,
        waveRewardMul: 1.2, diceGoodChance: 0.55, expMul: 0.8,
        bossExtraSkill: 0, dicePoolReduce: false,
    },
    [Difficulty.NORMAL]: {
        name: '中等',
        enemyHpMul: 1.0, enemySpeedMul: 1.0, startGold: 200, crystalHp: 5,
        waveRewardMul: 1.0, diceGoodChance: 0.50, expMul: 1.0,
        bossExtraSkill: 0, dicePoolReduce: false,
    },
    [Difficulty.HARD]: {
        name: '困难',
        enemyHpMul: 1.3, enemySpeedMul: 1.1, startGold: 150, crystalHp: 3,
        waveRewardMul: 0.9, diceGoodChance: 0.45, expMul: 2.0,
        bossExtraSkill: 1, dicePoolReduce: true,
    },
});

export interface MultiplayerDef {
    enemyHpMul: number;
    enemyCountMul: number;
    startGold: number;
    towerLimit: number;
    bossExtraSkill: number;
    growthMul: number;
}

export const MultiplayerConfig: Record<1 | 2 | 3 | 4, MultiplayerDef> = Object.freeze({
    1: { enemyHpMul: 1.0, enemyCountMul: 1.0, startGold: 200, towerLimit: Infinity, bossExtraSkill: 0, growthMul: 1.0 },
    2: { enemyHpMul: 1.6, enemyCountMul: 1.8, startGold: 200, towerLimit: 12,       bossExtraSkill: 0, growthMul: 1.0 },
    3: { enemyHpMul: 2.2, enemyCountMul: 2.5, startGold: 180, towerLimit: 10,       bossExtraSkill: 1, growthMul: 0.9 },
    4: { enemyHpMul: 2.8, enemyCountMul: 3.2, startGold: 160, towerLimit: 8,        bossExtraSkill: 1, growthMul: 0.8 },
});

/** 金币赠送折损率 */
export const GIFT_LOSS_RATE = 0.20;
