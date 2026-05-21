/**
 * Buff/Debuff 运行时管理（来自需求文档 §F-3.5）
 */

import { Duration } from '@rtd/shared';

export interface BuffCard {
    id: string;
    name?: string;
    duration: string;
    category?: string;
    effect?: {
        target: string;
        kind: string;
        value: number | { [key: string]: number };
    };
}

export interface PlayerBuff {
    id: string;
    name?: string;
    kind: string;
    value: number | { [key: string]: number };
    duration: string;
    target: string;
}

export interface GlobalMod {
    atkPct: number;
    spdPct: number;
    rangeAdd: number;
    critPct: number;
    critDmgPct: number;
    costMulPct: number;
    gainPct: number;
}

export interface EnemyWaveMod {
    hpPct: number;
    speedPct: number;
    armorAdd: number;
    dmgAdd: number;
    countPct: number;
    regenPct: number;
    takenDmgPct: number;
    paralyze: boolean;
    confusePct: number;
    elite: boolean;
    hpDeltaPct: number;
}

export class BuffManager {
    public playerBuffs: Map<string, PlayerBuff[]> = new Map();
    public nextWaveEnemyBuffs: BuffCard[] = [];

    initPlayer(playerId: string): void {
        if (!this.playerBuffs.has(playerId)) this.playerBuffs.set(playerId, []);
    }

    /** 应用一个骰子/抽卡效果，返回是否生效（即时效果由调用方处理） */
    applyEffect(playerId: string, effectCard: BuffCard): { applied: boolean; instant?: boolean } {
        this.initPlayer(playerId);
        const { effect, duration } = effectCard;
        if (!effect) return { applied: false };

        if (duration === Duration.INSTANT) {
            return { applied: true, instant: true };
        }
        if (effect.target === 'NEXT_WAVE_ENEMIES') {
            this.nextWaveEnemyBuffs.push({ ...effectCard });
            return { applied: true };
        }
        const list = this.playerBuffs.get(playerId)!;
        list.push({
            id: effectCard.id,
            name: effectCard.name,
            kind: effect.kind,
            value: effect.value,
            duration,
            target: effect.target,
        });
        return { applied: true };
    }

    /** 玩家所有塔的全局修正（乘算叠加） */
    getGlobalModifier(playerId: string): GlobalMod {
        const list = this.playerBuffs.get(playerId) || [];
        const mod: GlobalMod = {
            atkPct: 0, spdPct: 0, rangeAdd: 0, critPct: 0, critDmgPct: 0, costMulPct: 0, gainPct: 0,
        };
        for (const b of list) {
            if (b.target !== 'SELF_TOWERS' && b.target !== 'PLAYER' && b.target !== 'ECONOMY') continue;
            const v = b.value;
            switch (b.kind) {
                case 'ATK_PCT':      mod.atkPct   += v as number; break;
                case 'SPD_PCT':      mod.spdPct   += v as number; break;
                case 'RANGE_ADD':    mod.rangeAdd += v as number; break;
                case 'CRIT_PCT':     mod.critPct  += v as number; break;
                case 'ATK_AND_SPD':
                    mod.atkPct += v as number;
                    mod.spdPct += v as number;
                    break;
                case 'CRIT_AND_DMG':
                    mod.critPct    += (v as { crit: number; critDmg: number }).crit;
                    mod.critDmgPct += (v as { crit: number; critDmg: number }).critDmg;
                    break;
                case 'SPD_AND_COST':
                    mod.spdPct     += (v as { spd: number; cost: number }).spd;
                    mod.costMulPct += (v as { spd: number; cost: number }).cost;
                    break;
                default: break;
            }
        }
        return mod;
    }

    /** 下波怪物的整体修正 */
    consumeEnemyWaveModifier(): EnemyWaveMod {
        const mod: EnemyWaveMod = {
            hpPct: 0, speedPct: 0, armorAdd: 0, dmgAdd: 0, countPct: 0,
            regenPct: 0, takenDmgPct: 0, paralyze: false, confusePct: 0,
            elite: false, hpDeltaPct: 0,
        };
        for (const b of this.nextWaveEnemyBuffs) {
            const e = b.effect!;
            const v = typeof e.value === 'number' ? e.value : 0;
            switch (e.kind) {
                case 'HP_PCT':          mod.hpPct       += v; mod.hpDeltaPct += v; break;
                case 'SPEED_PCT':       mod.speedPct    += v; break;
                case 'ARMOR_PCT':       mod.armorAdd    += Math.round(v * 50); break;
                case 'ARMOR_ADD':       mod.armorAdd    += v; break;
                case 'DMG_TO_CRYSTAL':  mod.dmgAdd      += v; break;
                case 'COUNT_PCT':       mod.countPct    += v; break;
                case 'REGEN_PCT':       mod.regenPct    += v; break;
                case 'TAKEN_PCT':       mod.takenDmgPct += v; break;
                case 'PARALYZE':        mod.paralyze     = true; break;
                case 'CONFUSE':         mod.confusePct  += v; break;
                case 'ELITE_ONE':       mod.elite        = true; break;
                default: break;
            }
        }
        this.nextWaveEnemyBuffs.length = 0;
        return mod;
    }

    /** 波次结束清理 1 波类玩家 buff */
    expireOneWave(): void {
        for (const [playerId, list] of this.playerBuffs) {
            const remain = list.filter((b) => b.duration !== Duration.ONE_WAVE);
            this.playerBuffs.set(playerId, remain);
        }
    }

    list(playerId: string): PlayerBuff[] {
        return (this.playerBuffs.get(playerId) || []).slice();
    }
}
