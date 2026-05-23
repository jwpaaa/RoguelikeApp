/**
 * 怪物实体（Model 层）
 * ---------------------------------------------------------------
 * 怪物在路径上按 pathIndex 前进，渲染层根据 x/y 插值显示。
 */

import {
    EnemyConfig, BossConfig, computeHp, computeBossHp, BASE,
    type EnemyTypeValue, type BossTypeValue,
} from '../../shared/index';

let _seq = 1;
function nextId(): string { return `e_${_seq++}`; }

export interface PathNode { x: number; y: number; }

export interface EnemyInit {
    type: EnemyTypeValue | 'BOSS';
    wave: number;
    path: PathNode[];
    bossType?: BossTypeValue;
    hpMul?: number;
    speedMul?: number;
    armorAdd?: number;
    regenPct?: number;
    dmgAdd?: number;
    elite?: boolean;
    hpDeltaPct?: number;
    takenDmgPct?: number;
    confusePct?: number;
    paralyze?: boolean;
}

export interface DotStack {
    dotPerSec: number;
    remainMs: number;
}

export type DamageTypeStr = 'PHYSICAL' | 'MAGIC' | 'TRUE';

export interface DamageResult {
    actual: number;
    killed: boolean;
    immune?: boolean;
}

export class Enemy {
    public id: string;
    public type: EnemyTypeValue | 'BOSS';
    public path: PathNode[];
    public pathIndex: number = 0;
    public segProgress: number = 0;
    public dead: boolean = false;
    public reachedEnd: boolean = false;

    public bossType?: BossTypeValue;
    public maxHp: number;
    public hp: number;
    public armor: number;
    public mr: number;
    public baseSpeed: number;
    public reward: number;
    public dmgToCrystal: number;
    public flying: boolean = false;
    public stealth: boolean = false;
    public shield: number = 0;
    public ability?: string;
    public name: string;
    public isBoss: boolean = false;

    public elite: boolean;
    public takenDmgPct: number;
    public regenPct: number;
    public confusePct: number;
    public paralyze: boolean;
    public paralyzeAccMs: number = 0;

    public slowMul: number = 1;
    public slowRemainMs: number = 0;
    public frozenMs: number = 0;
    public dotStacks: DotStack[] = [];
    public lastHitBy: string | null = null;

    public x: number;
    public y: number;

    constructor(init: EnemyInit) {
        this.id = nextId();
        this.type = init.type;
        this.path = init.path;

        const isBoss = !!init.bossType;
        if (isBoss) {
            const bcfg = BossConfig[init.bossType!];
            this.bossType = init.bossType;
            this.maxHp = computeBossHp(init.bossType!, init.wave);
            this.hp = this.maxHp;
            this.armor = bcfg.armor + (init.armorAdd || 0);
            this.mr = bcfg.magicResist;
            this.baseSpeed = BASE.SPEED * bcfg.speedMul;
            this.reward = bcfg.reward;
            this.dmgToCrystal = bcfg.damage;
            this.ability = bcfg.ability;
            this.name = bcfg.name;
            this.isBoss = true;
        } else {
            const cfg = EnemyConfig[init.type as EnemyTypeValue];
            this.maxHp = Math.round(computeHp(init.type as EnemyTypeValue, init.wave) * (init.hpMul || 1) * (1 + (init.hpDeltaPct || 0)));
            this.hp = this.maxHp;
            this.armor = cfg.armor + (init.armorAdd || 0);
            this.mr = cfg.magicResist;
            this.baseSpeed = BASE.SPEED * cfg.speedMul * (init.speedMul || 1);
            this.reward = cfg.reward;
            this.dmgToCrystal = cfg.damage + (init.dmgAdd || 0);
            this.flying = !!cfg.flying;
            this.stealth = !!cfg.stealth;
            this.shield = cfg.shield ? this.maxHp : 0;
            this.ability = cfg.ability;
            this.name = cfg.name;
        }

        // 精英化
        this.elite = !!init.elite;
        if (this.elite) {
            this.maxHp = Math.round(this.maxHp * 1.5);
            this.hp = this.maxHp;
            this.armor += 30;
            this.mr += 30;
        }

        this.takenDmgPct = init.takenDmgPct || 0;
        this.regenPct    = init.regenPct || 0;
        this.confusePct  = init.confusePct || 0;
        this.paralyze    = !!init.paralyze;

        // 起点位置
        const start = this.path[0];
        this.x = start.x;
        this.y = start.y;
    }

    /** 当前可见性（隐身怪是否被反隐） */
    isVisible(detectStealthSet?: Set<string>): boolean {
        if (!this.stealth) return true;
        return !!(detectStealthSet && detectStealthSet.has(this.id));
    }

    /** 当前每帧速度（格/帧） */
    getSpeed(): number {
        if (this.frozenMs > 0) return 0;
        return this.baseSpeed * this.slowMul;
    }

    /**
     * 受到伤害（含护甲减免、易伤系数）
     * @returns 实际伤害与是否击杀
     */
    takeDamage(rawDmg: number, dmgType: DamageTypeStr, srcPlayerId?: string): DamageResult {
        if (this.dead) return { actual: 0, killed: false };
        if (rawDmg <= 0) return { actual: 0, killed: false };

        let dmg = rawDmg * (1 + this.takenDmgPct);
        if (dmgType === 'PHYSICAL') {
            dmg = dmg * (1 - this.armor / (this.armor + 100));
        } else if (dmgType === 'MAGIC') {
            dmg = dmg * (1 - this.mr / (this.mr + 100));
        }
        dmg = Math.max(0, Math.round(dmg));

        if (this.shield > 0) {
            const absorbed = Math.min(this.shield, dmg);
            this.shield -= absorbed;
            dmg -= absorbed;
        }
        this.hp -= dmg;
        if (srcPlayerId) this.lastHitBy = srcPlayerId;

        if (this.hp <= 0) {
            this.hp = 0;
            this.dead = true;
            return { actual: dmg, killed: true };
        }
        return { actual: dmg, killed: false };
    }

    /** 应用减速：取最严厉者 */
    applySlow(slowPct: number, durationMs: number): void {
        const newMul = 1 - slowPct;
        if (newMul < this.slowMul || this.slowRemainMs <= 0) {
            this.slowMul = newMul;
        }
        this.slowRemainMs = Math.max(this.slowRemainMs, durationMs);
    }

    /** 应用冰冻 */
    applyFreeze(durationMs: number): void {
        this.frozenMs = Math.max(this.frozenMs, durationMs);
    }

    /** 叠加一层独立 DOT */
    addDot(dotPerSec: number, durationMs: number, maxStack: number): void {
        if (this.dotStacks.length >= maxStack) {
            this.dotStacks.shift();
        }
        this.dotStacks.push({ dotPerSec, remainMs: durationMs });
    }
}
