/**
 * 天赋树配置（来自需求文档 §F-5.1）
 */

export const TalentBranch = Object.freeze({
    ATTACK:  'ATTACK',
    DEFENSE: 'DEFENSE',
    LUCK:    'LUCK',
});

export type TalentBranchValue = typeof TalentBranch[keyof typeof TalentBranch];

export interface TalentNode {
    id: string;
    branch: TalentBranchValue;
    name: string;
    desc: string;
    maxLevel: number;
    costPerLevel: number[];
    effect: { kind: string; values: number[] };
}

/** 攻击分支 */
const AttackTalents: TalentNode[] = [
    { id: 'A1', branch: TalentBranch.ATTACK, name: '塔基础攻击', desc: '塔攻击 +5/10/15%',  maxLevel: 3, costPerLevel: [1, 2, 3], effect: { kind: 'GLOBAL_ATK_PCT', values: [0.05, 0.10, 0.15] } },
    { id: 'A2', branch: TalentBranch.ATTACK, name: '暴击率',     desc: '暴击率 +3/6/10%',   maxLevel: 3, costPerLevel: [1, 2, 3], effect: { kind: 'GLOBAL_CRIT',    values: [0.03, 0.06, 0.10] } },
    { id: 'A3', branch: TalentBranch.ATTACK, name: '初始金币',   desc: '+50/100/200',       maxLevel: 3, costPerLevel: [1, 2, 3], effect: { kind: 'START_GOLD',     values: [50, 100, 200] } },
    { id: 'A4', branch: TalentBranch.ATTACK, name: '战术大师',   desc: '解锁塔目标模式切换', maxLevel: 1, costPerLevel: [2],       effect: { kind: 'UNLOCK_TARGET_MODE', values: [1] } },
];

const DefenseTalents: TalentNode[] = [
    { id: 'D1', branch: TalentBranch.DEFENSE, name: '水晶生命', desc: '初始生命 +1/+2/+3', maxLevel: 3, costPerLevel: [1, 2, 3], effect: { kind: 'CRYSTAL_HP',     values: [1, 2, 3] } },
    { id: 'D2', branch: TalentBranch.DEFENSE, name: '建造优惠', desc: '建造 -5/10/15%',     maxLevel: 3, costPerLevel: [1, 2, 3], effect: { kind: 'BUILD_DISCOUNT', values: [0.05, 0.10, 0.15] } },
    { id: 'D3', branch: TalentBranch.DEFENSE, name: '护盾掌握', desc: '护盾获取 +1/+2',     maxLevel: 2, costPerLevel: [2, 3],    effect: { kind: 'SHIELD_BONUS',   values: [1, 2] } },
];

const LuckTalents: TalentNode[] = [
    { id: 'L1', branch: TalentBranch.LUCK, name: '吉星高照', desc: '骰子 1-3 点率 +5/10/15%', maxLevel: 3, costPerLevel: [1, 2, 3], effect: { kind: 'DICE_GOOD_PCT', values: [0.05, 0.10, 0.15] } },
    { id: 'L2', branch: TalentBranch.LUCK, name: 'SR增幅',   desc: '抽卡 SR 率 +2/4%',        maxLevel: 2, costPerLevel: [2, 3],    effect: { kind: 'GACHA_SR_PCT',  values: [0.02, 0.04] } },
    { id: 'L3', branch: TalentBranch.LUCK, name: '免疫诅咒', desc: '队友减益免疫 +10/20/30%', maxLevel: 3, costPerLevel: [1, 2, 3], effect: { kind: 'ALLY_DEBUFF_RESIST', values: [0.10, 0.20, 0.30] } },
];

export const TalentConfig: Record<TalentBranchValue, TalentNode[]> = Object.freeze({
    [TalentBranch.ATTACK]:  AttackTalents,
    [TalentBranch.DEFENSE]: DefenseTalents,
    [TalentBranch.LUCK]:    LuckTalents,
});

/** 每升一级获得 1 点天赋点 */
export function getTalentPointsByLevel(level: number): number { return level; }

/** 经验 → 等级（线性 + 加速曲线） */
export function getLevelByExp(exp: number): number {
    let lv = 1;
    let need = 0;
    for (;;) {
        const cost = 100 + lv * 50;
        if (need + cost > exp) break;
        need += cost;
        lv++;
        if (lv > 100) break;
    }
    return lv;
}

export interface BattleExpInput {
    wave: number;
    kills: number;
    win: boolean;
    expMul?: number;
}

/** 一场对局的经验：通关波次×10 + 击杀×2 + 胜利200 */
export function calcBattleExp({ wave, kills, win, expMul }: BattleExpInput): number {
    const base = wave * 10 + kills * 2 + (win ? 200 : 0);
    return Math.floor(base * (expMul || 1));
}
