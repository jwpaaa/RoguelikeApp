/**
 * 客户端 / 服务端共享：骰子池配置
 * ---------------------------------------------------------------
 * 四个池：己方增益 (10) / 敌方减益 (7) / 怪物增益 (7) / 队友减益 (7)
 * 抽取规则：
 *   骰 1-3 → 从 [SelfBuffPool + EnemyDebuffPool] = 17 中不重复抽 3
 *   骰 4-6 → 从 [EnemyBuffPool + AllyDebuffPool] = 14 中不重复抽 3
 *
 * 困难难度：正面池缩水为 14（己方增益取前 7 + 敌方减益 7）
 */

export const DiceCategory = {
    SELF_BUFF:    'SELF_BUFF',
    ENEMY_DEBUFF: 'ENEMY_DEBUFF',
    ENEMY_BUFF:   'ENEMY_BUFF',
    ALLY_DEBUFF:  'ALLY_DEBUFF',
} as const;

export type DiceCategoryValue = typeof DiceCategory[keyof typeof DiceCategory];

export const Duration = {
    PERMANENT: 'PERMANENT',
    ONE_WAVE:  'ONE_WAVE',
    INSTANT:   'INSTANT',
} as const;

export type DurationValue = typeof Duration[keyof typeof Duration];

/** 单个效果的描述结构 */
export interface DiceEffect {
    id: string;
    name: string;
    icon?: string;
    desc: string;
    category: DiceCategoryValue;
    duration: DurationValue;
    effect: {
        target: string;
        kind: string;
        value: number | { [key: string]: number };
    };
}

export const SelfBuffPool: readonly DiceEffect[] = Object.freeze([
    { id: 'B-01', name: '攻击强化', icon: '⚔️', desc: '所有塔攻击力 +20%',     category: DiceCategory.SELF_BUFF, duration: Duration.PERMANENT, effect: { target: 'SELF_TOWERS', kind: 'ATK_PCT',   value: 0.20 } },
    { id: 'B-02', name: '精准打击', icon: '🎯', desc: '所有塔暴击率 +15%',     category: DiceCategory.SELF_BUFF, duration: Duration.PERMANENT, effect: { target: 'SELF_TOWERS', kind: 'CRIT_PCT',  value: 0.15 } },
    { id: 'B-03', name: '淘金热',   icon: '💰', desc: '下一波金币获取 +50%',   category: DiceCategory.SELF_BUFF, duration: Duration.ONE_WAVE,  effect: { target: 'ECONOMY',     kind: 'GOLD_GAIN', value: 0.50 } },
    { id: 'B-04', name: '极速建造', icon: '🔨', desc: '本回合建造/升级 -30%',  category: DiceCategory.SELF_BUFF, duration: Duration.ONE_WAVE,  effect: { target: 'ECONOMY',     kind: 'COST_PCT',  value: -0.30 } },
    { id: 'B-05', name: '水晶护盾', icon: '🛡️', desc: '水晶获得 1 层护盾',      category: DiceCategory.SELF_BUFF, duration: Duration.PERMANENT, effect: { target: 'CRYSTAL',     kind: 'SHIELD',    value: 1 } },
    { id: 'B-06', name: '射程扩展', icon: '📏', desc: '所有塔射程 +0.5 格',    category: DiceCategory.SELF_BUFF, duration: Duration.PERMANENT, effect: { target: 'SELF_TOWERS', kind: 'RANGE_ADD', value: 0.5 } },
    { id: 'B-07', name: '生命恢复', icon: '💚', desc: '水晶恢复 1 点生命',     category: DiceCategory.SELF_BUFF, duration: Duration.INSTANT,   effect: { target: 'CRYSTAL',     kind: 'HEAL',      value: 1 } },
    { id: 'B-08', name: '攻速提升', icon: '⚡', desc: '所有塔攻击速度 +20%',   category: DiceCategory.SELF_BUFF, duration: Duration.PERMANENT, effect: { target: 'SELF_TOWERS', kind: 'SPD_PCT',   value: 0.20 } },
    { id: 'B-09', name: '火焰附魔', icon: '🔥', desc: '所有塔附带灼烧 2/s',    category: DiceCategory.SELF_BUFF, duration: Duration.PERMANENT, effect: { target: 'SELF_TOWERS', kind: 'BURN',      value: 2 } },
    { id: 'B-10', name: '意外之财', icon: '💎', desc: '立即获得 200 金币',     category: DiceCategory.SELF_BUFF, duration: Duration.INSTANT,   effect: { target: 'ECONOMY',     kind: 'GOLD_ADD',  value: 200 } },
]);

export const EnemyDebuffPool: readonly DiceEffect[] = Object.freeze([
    { id: 'D-01', name: '群体减速', icon: '🐌', desc: '下波怪物移速 -25%',   category: DiceCategory.ENEMY_DEBUFF, duration: Duration.ONE_WAVE, effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'SPEED_PCT', value: -0.25 } },
    { id: 'D-02', name: '易伤标记', icon: '💔', desc: '下波怪物受伤 +25%',   category: DiceCategory.ENEMY_DEBUFF, duration: Duration.ONE_WAVE, effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'TAKEN_PCT', value: 0.25 } },
    { id: 'D-03', name: '破甲诅咒', icon: '🔓', desc: '下波怪物护甲 -50%',   category: DiceCategory.ENEMY_DEBUFF, duration: Duration.ONE_WAVE, effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'ARMOR_PCT', value: -0.50 } },
    { id: 'D-04', name: '生命削减', icon: '💀', desc: '下波怪物 HP -15%',    category: DiceCategory.ENEMY_DEBUFF, duration: Duration.ONE_WAVE, effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'HP_PCT',    value: -0.15 } },
    { id: 'D-05', name: '麻痹陷阱', icon: '⚡', desc: '下波怪物周期麻痹',   category: DiceCategory.ENEMY_DEBUFF, duration: Duration.ONE_WAVE, effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'PARALYZE',  value: 1 } },
    { id: 'D-06', name: '伤害弱化', icon: '🎲', desc: '下波怪物对水晶 -1',  category: DiceCategory.ENEMY_DEBUFF, duration: Duration.ONE_WAVE, effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'DMG_TO_CRYSTAL', value: -1 } },
    { id: 'D-07', name: '混乱',     icon: '😵', desc: '下波怪物 10% 几率回头', category: DiceCategory.ENEMY_DEBUFF, duration: Duration.ONE_WAVE, effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'CONFUSE',   value: 0.10 } },
]);

export const EnemyBuffPool: readonly DiceEffect[] = Object.freeze([
    { id: 'M-01', name: '怪物强化', icon: '💪', desc: '下波怪物 HP +25%',     category: DiceCategory.ENEMY_BUFF, duration: Duration.ONE_WAVE, effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'HP_PCT',     value: 0.25 } },
    { id: 'M-02', name: '急速突袭', icon: '🏃', desc: '下波怪物移速 +20%',   category: DiceCategory.ENEMY_BUFF, duration: Duration.ONE_WAVE, effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'SPEED_PCT', value: 0.20 } },
    { id: 'M-03', name: '铁壁防御', icon: '🛡️', desc: '下波怪物护甲 +30',    category: DiceCategory.ENEMY_BUFF, duration: Duration.ONE_WAVE, effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'ARMOR_ADD', value: 30 } },
    { id: 'M-04', name: '狂暴',     icon: '😈', desc: '下波怪物对水晶 +1',    category: DiceCategory.ENEMY_BUFF, duration: Duration.ONE_WAVE, effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'DMG_TO_CRYSTAL', value: 1 } },
    { id: 'M-05', name: '增援部队', icon: '📦', desc: '下波怪物数量 +20%',    category: DiceCategory.ENEMY_BUFF, duration: Duration.ONE_WAVE, effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'COUNT_PCT', value: 0.20 } },
    { id: 'M-06', name: '再生',     icon: '💉', desc: '下波怪物每秒回 1%',    category: DiceCategory.ENEMY_BUFF, duration: Duration.ONE_WAVE, effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'REGEN_PCT', value: 0.01 } },
    { id: 'M-07', name: '精英化',   icon: '⭐', desc: '下波随机 1 只精英化',   category: DiceCategory.ENEMY_BUFF, duration: Duration.ONE_WAVE, effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'ELITE_ONE', value: 1 } },
]);

export const AllyDebuffPool: readonly DiceEffect[] = Object.freeze([
    { id: 'T-01', name: '税收',     icon: '💸', desc: '随机队友下波金币 -30%', category: DiceCategory.ALLY_DEBUFF, duration: Duration.ONE_WAVE, effect: { target: 'RANDOM_ALLY', kind: 'GOLD_GAIN_PCT', value: -0.30 } },
    { id: 'T-02', name: '塔封印',   icon: '🔒', desc: '随机冻结队友 1 塔 5s',   category: DiceCategory.ALLY_DEBUFF, duration: Duration.ONE_WAVE, effect: { target: 'RANDOM_ALLY', kind: 'FREEZE_TOWER',  value: 5 } },
    { id: 'T-03', name: '属性衰减', icon: '📉', desc: '随机队友塔攻击 -15%',   category: DiceCategory.ALLY_DEBUFF, duration: Duration.ONE_WAVE, effect: { target: 'RANDOM_ALLY', kind: 'ATK_PCT',       value: -0.15 } },
    { id: 'T-04', name: '建造迟缓', icon: '🐢', desc: '随机队友建造 +30%',     category: DiceCategory.ALLY_DEBUFF, duration: Duration.ONE_WAVE, effect: { target: 'RANDOM_ALLY', kind: 'COST_PCT',      value: 0.30 } },
    { id: 'T-05', name: '射程缩短', icon: '🎯', desc: '随机队友塔射程 -0.5',   category: DiceCategory.ALLY_DEBUFF, duration: Duration.ONE_WAVE, effect: { target: 'RANDOM_ALLY', kind: 'RANGE_ADD',     value: -0.5 } },
    { id: 'T-06', name: '攻速降低', icon: '⏳', desc: '随机队友塔攻速 -20%',   category: DiceCategory.ALLY_DEBUFF, duration: Duration.ONE_WAVE, effect: { target: 'RANDOM_ALLY', kind: 'SPD_PCT',       value: -0.20 } },
    { id: 'T-07', name: '金币扣除', icon: '💰', desc: '随机队友立即 -80 金币', category: DiceCategory.ALLY_DEBUFF, duration: Duration.INSTANT,  effect: { target: 'RANDOM_ALLY', kind: 'GOLD_ADD',      value: -80 } },
]);

/** 每次掷骰从合并池中抽取 N 个 */
export const PICK_COUNT = 3;

/**
 * 根据骰子点数获取候选池（合并后的 17/14 个）
 * @param dice 1-6
 * @param reducedPositive 困难模式正面池缩小
 */
export function getCandidatePool(dice: number, reducedPositive: boolean = false): DiceEffect[] {
    if (dice >= 1 && dice <= 3) {
        if (reducedPositive) {
            return [...SelfBuffPool.slice(0, 7), ...EnemyDebuffPool];
        }
        return [...SelfBuffPool, ...EnemyDebuffPool];
    }
    return [...EnemyBuffPool, ...AllyDebuffPool];
}
