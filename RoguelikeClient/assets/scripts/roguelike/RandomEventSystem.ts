/**
 * 随机事件系统（来自需求文档 §F-3.6）
 */

import { RandomEventPool, TRIGGER_RATE, RandomEventId, type RandomEventDef } from '../config/RandomEventConfig';
import { isBossWave } from '../config/WaveConfig';
import { instance as EventBus } from '../core/EventBus';
import type { SeededRandom } from '../utils/SeededRandom';
import type { EconomyManager } from '../battle/EconomyManager';
import type { EntityManager } from '../battle/EntityManager';
import type { Crystal } from '../entity/Crystal';
import type { ShopController } from '../battle/ShopController';
import type { BuffManager } from '../battle/BuffManager';

export interface EvtCtx {
    rng: SeededRandom;
    economy: EconomyManager;
    entityManager: EntityManager;
    crystal: Crystal;
    shopController: ShopController;
    buffManager: BuffManager;
}

export class RandomEventSystem {
    public rng: SeededRandom;
    public economy: EconomyManager;
    public em: EntityManager;
    public crystal: Crystal;
    public shop: ShopController;
    public bm: BuffManager;

    constructor(ctx: EvtCtx) {
        this.rng = ctx.rng;
        this.economy = ctx.economy;
        this.em = ctx.entityManager;
        this.crystal = ctx.crystal;
        this.shop = ctx.shopController;
        this.bm = ctx.buffManager;
    }

    maybeTrigger(wave: number, playerIds: string[]): RandomEventDef | null {
        if (isBossWave(wave)) return null;
        if (this.rng.next() >= TRIGGER_RATE) return null;
        const evt = this.rng.pickOne(RandomEventPool)!;
        this._apply(evt, playerIds);
        EventBus.emit('random_event', { event: evt, wave });
        return evt;
    }

    private _apply(evt: RandomEventDef, playerIds: string[]): void {
        switch (evt.id) {
            case RandomEventId.SHOP_DISCOUNT:
                this.shop.setNextDiscount(0.5);
                break;
            case RandomEventId.TREASURE_CHEST: {
                const g = this.rng.nextIntInclusive(50, 200);
                for (const pid of playerIds) this.economy.addGold(pid, g, 'event_chest');
                break;
            }
            case RandomEventId.CURSE: {
                const towers = Array.from(this.em.towers.values()).filter((t) => !t.dead);
                if (towers.length > 0) {
                    const t = this.rng.pickOne(towers)!;
                    t.frozenMs = 30000;
                    EventBus.emit('tower_frozen', { towerId: t.id });
                }
                break;
            }
            case RandomEventId.DIVINE:
                this.crystal.heal(2);
                break;
            case RandomEventId.REBELLION:
                this.bm.nextWaveEnemyBuffs.push({
                    id: 'EVT-REB',
                    name: '暴风雨前夜',
                    duration: 'ONE_WAVE',
                    effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'COUNT_PCT', value: 0.5 },
                });
                break;
            case RandomEventId.LUCKY_DAY: {
                for (const pid of playerIds) this.economy.addGainMul(pid, 1.0);
                break;
            }
            case RandomEventId.TOWER_BLESS: {
                const towers = Array.from(this.em.towers.values()).filter((t) => !t.dead);
                if (towers.length > 0) {
                    const t = this.rng.pickOne(towers)!;
                    t.buffs.push({ kind: 'ATK_PCT', value: 0.30, source: 'EVT-BLESS' });
                    EventBus.emit('tower_blessed', { towerId: t.id });
                }
                break;
            }
            default: break;
        }
    }
}
