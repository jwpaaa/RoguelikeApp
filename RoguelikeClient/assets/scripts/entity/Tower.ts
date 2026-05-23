/**
 * 防御塔实体（Model 层）
 * ---------------------------------------------------------------
 * 仅承载塔的"游戏数据"，渲染层（Cocos 节点）由 TowerView 单独绑定。
 * 战斗逻辑里使用浮点便于阅读；最终命中扣血的伤害由 DamageCalculator
 * 在内部转 FixedPoint 计算，再 round 回整数 HP。
 */

import { TowerConfig, TargetMode, type TowerLevelStats, type TowerTypeValue, type TargetModeValue } from '../../shared/index';

let _seq = 1;
function nextId(): string { return `tw_${_seq++}`; }

export interface TowerInit {
    ownerId: string;
    type: TowerTypeValue;
    x: number;
    y: number;
    level?: number;
    targetMode?: TargetModeValue;
}

export interface TowerGrowth {
    atk: number; atkSpeed: number; range: number; slow: number; slowDur: number;
    pierce: number; dot: number; dotDur: number; maxStack: number; chain: number;
    splash: number; auraAtk: number; auraRange: number; minionHp: number; minionAtk: number;
    [key: string]: number;
}

export interface SingleBuff {
    kind: string;
    value: number;
    source?: string;
}

export interface GlobalMod {
    atkPct?: number;
    spdPct?: number;
    rangeAdd?: number;
    critPct?: number;
    critDmgPct?: number;
    costMulPct?: number;
    gainPct?: number;
}

export interface AuraMod {
    atkPct?: number;
    spdPct?: number;
}

export class Tower {
    public id: string;
    public ownerId: string;
    public type: TowerTypeValue;
    public level: number;
    public x: number;
    public y: number;
    public targetMode: TargetModeValue;
    public cooldownMs: number = 0;
    public frozenMs: number = 0;
    public summonCdMs: number = 0;
    public buffs: SingleBuff[] = [];
    public growth: TowerGrowth;
    public dead: boolean = false;

    constructor(init: TowerInit) {
        this.id = nextId();
        this.ownerId = init.ownerId;
        this.type = init.type;
        this.level = init.level || 1;
        this.x = init.x;
        this.y = init.y;
        this.targetMode = init.targetMode || TargetMode.FIRST;
        this.growth = {
            atk: 0, atkSpeed: 0, range: 0, slow: 0, slowDur: 0,
            pierce: 0, dot: 0, dotDur: 0, maxStack: 0, chain: 0,
            splash: 0, auraAtk: 0, auraRange: 0, minionHp: 0, minionAtk: 0,
        };
    }

    /** 获取塔的等级配置 */
    getLevelStat(): TowerLevelStats {
        return TowerConfig[this.type].levels[this.level - 1] || TowerConfig[this.type].levels[0];
    }

    /** 是否为图腾塔（不主动攻击） */
    isTotem():    boolean { return this.type === 'TOTEM'; }
    isSummoner(): boolean { return this.type === 'SUMMON'; }

    /** 是否具备反隐 */
    canDetectStealth(): boolean {
        return !!this.getLevelStat().detectStealth;
    }

    /** 最终攻击力（含成长、单体 buff、玩家全局 buff、光环） */
    getEffectiveAttack(globalMod?: GlobalMod, auraMod?: AuraMod): number {
        const base = this.getLevelStat().atk || 0;
        let atk = base + (this.growth.atk || 0);
        let pct = 0;
        for (const b of this.buffs) {
            if (b.kind === 'ATK_PCT') pct += b.value;
        }
        atk *= 1 + pct;
        if (globalMod && globalMod.atkPct) atk *= 1 + globalMod.atkPct;
        if (auraMod && auraMod.atkPct)     atk *= 1 + auraMod.atkPct;
        return atk;
    }

    /** 攻击间隔（毫秒）—— 攻速加成乘算 */
    getEffectiveAttackIntervalMs(globalMod?: GlobalMod, auraMod?: AuraMod): number {
        const base = this.getLevelStat().atkSpeed || 1;
        let interval = base + (this.growth.atkSpeed || 0);
        let pct = 0;
        for (const b of this.buffs) if (b.kind === 'SPD_PCT') pct += b.value;
        if (globalMod && globalMod.spdPct) pct += globalMod.spdPct;
        if (auraMod && auraMod.spdPct)     pct += auraMod.spdPct;
        if (pct > 0) interval /= (1 + pct);
        else if (pct < 0) interval *= (1 + Math.abs(pct));
        return Math.max(0.1, interval) * 1000;
    }

    /** 射程（格） */
    getEffectiveRange(globalMod?: GlobalMod): number {
        const base = this.getLevelStat().range || 0;
        let r = base + (this.growth.range || 0);
        if (globalMod && globalMod.rangeAdd) r += globalMod.rangeAdd;
        return r;
    }

    /** 暴击率 */
    getCritRate(globalMod?: GlobalMod): number {
        let c = 0;
        if (globalMod && globalMod.critPct) c += globalMod.critPct;
        return Math.min(c, 1);
    }

    /** 暴击伤害倍率（默认 1.5） */
    getCritDamage(globalMod?: GlobalMod): number {
        let d = 1.5;
        if (globalMod && globalMod.critDmgPct) d += globalMod.critDmgPct;
        return d;
    }
}
