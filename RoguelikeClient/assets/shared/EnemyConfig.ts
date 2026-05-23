/**
 * 客户端 / 服务端共享：怪物配置
 * ---------------------------------------------------------------
 * 12 种普通怪 + 4 种 BOSS。
 * 基准值：普通小怪 HP=100, 移速=0.02 格/逻辑帧（每帧 66ms），扣 1 生命。
 */

export const EnemyType = {
    NORMAL:   'NORMAL',
    FAST:     'FAST',
    TANK:     'TANK',
    FLYING:   'FLYING',
    HEALER:   'HEALER',
    SPLITTER: 'SPLITTER',
    STEALTH:  'STEALTH',
    SHIELD:   'SHIELD',
    SUMMONER: 'SUMMONER',
    BOMBER:   'BOMBER',
    ELITE:    'ELITE',
    BOSS:     'BOSS',
} as const;

export type EnemyTypeValue = typeof EnemyType[keyof typeof EnemyType];

export const BossType = {
    WOLF_KING:    'WOLF_KING',
    ROCK_GIANT:   'ROCK_GIANT',
    SHADOW_LORD:  'SHADOW_LORD',
    DRAGON_KING:  'DRAGON_KING',
} as const;

export type BossTypeValue = typeof BossType[keyof typeof BossType];

export const BASE = Object.freeze({
    HP: 100,
    SPEED: 0.02,
    DAMAGE_TO_CRYSTAL: 1,
    HP_GROWTH_PER_WAVE: 0.08,
});

export interface EnemyStat {
    name: string;
    hpMul: number;
    speedMul: number;
    armor: number;
    magicResist: number;
    reward: number;
    damage: number;
    flying?: boolean;
    stealth?: boolean;
    shield?: boolean;
    ability?: string;
}

export const EnemyConfig: Record<EnemyTypeValue, EnemyStat> = {
    [EnemyType.NORMAL]:   { name: '普通小怪', hpMul: 1.0, speedMul: 1.0, armor: 0,  magicResist: 0,  reward: 10, damage: 1 },
    [EnemyType.FAST]:     { name: '疾行怪',   hpMul: 0.6, speedMul: 2.0, armor: 0,  magicResist: 0,  reward: 15, damage: 1 },
    [EnemyType.TANK]:     { name: '重甲怪',   hpMul: 3.0, speedMul: 0.5, armor: 50, magicResist: 0,  reward: 25, damage: 1 },
    [EnemyType.FLYING]:   { name: '飞行怪',   hpMul: 0.8, speedMul: 1.2, armor: 0,  magicResist: 20, reward: 18, damage: 1, flying: true },
    [EnemyType.HEALER]:   { name: '治疗师',   hpMul: 1.2, speedMul: 0.8, armor: 10, magicResist: 10, reward: 20, damage: 1, ability: 'heal' },
    [EnemyType.SPLITTER]: { name: '分裂怪',   hpMul: 1.5, speedMul: 1.0, armor: 0,  magicResist: 0,  reward: 22, damage: 1, ability: 'split' },
    [EnemyType.STEALTH]:  { name: '隐行怪',   hpMul: 1.0, speedMul: 1.1, armor: 0,  magicResist: 15, reward: 25, damage: 1, stealth: true },
    [EnemyType.SHIELD]:   { name: '护盾怪',   hpMul: 1.0, speedMul: 0.9, armor: 20, magicResist: 0,  reward: 20, damage: 1, shield: true },
    [EnemyType.SUMMONER]: { name: '召唤师',   hpMul: 1.3, speedMul: 0.7, armor: 15, magicResist: 15, reward: 30, damage: 1, ability: 'summon' },
    [EnemyType.BOMBER]:   { name: '自爆怪',   hpMul: 1.2, speedMul: 1.3, armor: 0,  magicResist: 0,  reward: 12, damage: 2 },
    [EnemyType.ELITE]:    { name: '精英怪',   hpMul: 1.5, speedMul: 1.0, armor: 30, magicResist: 30, reward: 40, damage: 1 },
    [EnemyType.BOSS]:     { name: 'BOSS',     hpMul: 0,   speedMul: 0,   armor: 0,  magicResist: 0,  reward: 200, damage: 3 }, // 占位，实际走 BossConfig
};

export interface BossStat {
    name: string;
    hp: number;
    speedMul: number;
    armor: number;
    magicResist: number;
    reward: number;
    damage: number;
    ability: string;
}

export const BossConfig: Record<BossTypeValue, BossStat> = {
    [BossType.WOLF_KING]:   { name: '巨狼王',    hp: 800,  speedMul: 0.8, armor: 20, magicResist: 0,  reward: 200, damage: 3, ability: 'howl_summon' },
    [BossType.ROCK_GIANT]:  { name: '岩石巨人',  hp: 1500, speedMul: 0.5, armor: 80, magicResist: 0,  reward: 200, damage: 4, ability: 'earthquake_stun' },
    [BossType.SHADOW_LORD]: { name: '暗影领主',  hp: 1200, speedMul: 1.2, armor: 40, magicResist: 40, reward: 200, damage: 4, ability: 'shadow_clone' },
    [BossType.DRAGON_KING]: { name: '终极龙王',  hp: 3000, speedMul: 0.6, armor: 60, magicResist: 60, reward: 200, damage: 5, ability: 'dragon_breath' },
};

/** 第 wave 波 HP（基准 × 倍率 × 波次成长） */
export function computeHp(enemyType: EnemyTypeValue, wave: number): number {
    const cfg = EnemyConfig[enemyType];
    if (!cfg) return BASE.HP;
    const growth = 1 + BASE.HP_GROWTH_PER_WAVE * (wave - 1);
    return Math.round(BASE.HP * cfg.hpMul * growth);
}

/** BOSS HP（自带固定 HP + 弱波次成长） */
export function computeBossHp(bossType: BossTypeValue, wave: number): number {
    const cfg = BossConfig[bossType];
    if (!cfg) return 1000;
    const growth = 1 + 0.05 * Math.max(0, wave - 5);
    return Math.round(cfg.hp * growth);
}
