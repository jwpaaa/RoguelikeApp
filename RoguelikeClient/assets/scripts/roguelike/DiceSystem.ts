/**
 * 骰子系统（来自需求文档 §F-3.1）
 */

import { getCandidatePool, PICK_COUNT, type DiceEffect } from '@rtd/shared';
import { instance as EventBus } from '../core/EventBus';
import type { SeededRandom } from '../utils/SeededRandom';
import type { BuffManager } from '../battle/BuffManager';

export interface DiceCtx {
    buffManager: BuffManager;
    rng: SeededRandom;
    reducedPositive?: boolean;
    getOnlineAllies?: () => string[];
    getDiceGoodChance?: (playerId: string) => number;
    getAllyResist?: (playerId: string) => number;
}

export interface DiceResult {
    dice: number;
    picks: DiceEffect[];
    allyTargets: Record<string, string>;
}

export class DiceSystem {
    public bm: BuffManager;
    public rng: SeededRandom;
    public reducedPositive: boolean;
    public getAllies: () => string[];
    public getGood:    (playerId: string) => number;
    public getResist:  (playerId: string) => number;
    public rerollCount: Map<string, number> = new Map();

    constructor(ctx: DiceCtx) {
        this.bm = ctx.buffManager;
        this.rng = ctx.rng;
        this.reducedPositive = !!ctx.reducedPositive;
        this.getAllies = ctx.getOnlineAllies || (() => []);
        this.getGood = ctx.getDiceGoodChance || (() => 0.5);
        this.getResist = ctx.getAllyResist || (() => 0);
    }

    grantReroll(playerId: string, count: number): void {
        this.rerollCount.set(playerId, (this.rerollCount.get(playerId) || 0) + count);
    }

    rollOnce(playerId: string): DiceResult {
        const goodChance = this.getGood(playerId);
        const good = this.rng.next() < goodChance;
        const dice = good
            ? this.rng.nextIntInclusive(1, 3)
            : this.rng.nextIntInclusive(4, 6);

        const pool = getCandidatePool(dice, this.reducedPositive);
        const picks: DiceEffect[] = this.rng.pickN(pool, PICK_COUNT);

        const allyTargets: Record<string, string> = {};
        for (const card of picks) {
            const t = card.effect.target;
            if (t === 'RANDOM_ALLY') {
                const allies = this.getAllies();
                if (allies.length === 0) continue;
                const target = this.rng.pickOne(allies)!;
                const resist = this.getResist(target);
                if (this.rng.next() < resist) {
                    allyTargets[card.id] = '__resisted__';
                    continue;
                }
                allyTargets[card.id] = target;
                this.bm.applyEffect(target, card);
            } else {
                this.bm.applyEffect(playerId, card);
            }
        }
        EventBus.emit('dice_rolled', { playerId, dice, picks, allyTargets });
        return { dice, picks, allyTargets };
    }
}
