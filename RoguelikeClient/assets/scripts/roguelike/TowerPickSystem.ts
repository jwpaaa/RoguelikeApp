/**
 * 塔三选一（来自需求文档 §F-3.4）
 */

import { TowerType, type TowerTypeValue } from '../../shared/index';
import type { SeededRandom } from '../utils/SeededRandom';
import type { TowerController } from '../battle/TowerController';
import type { EconomyManager } from '../battle/EconomyManager';

export interface PickCtx {
    rng: SeededRandom;
    unlockedTowers: Map<string, Set<TowerTypeValue>>;
    towerController: TowerController;
    economy: EconomyManager;
}

export class TowerPickSystem {
    public rng: SeededRandom;
    public unlocked: Map<string, Set<TowerTypeValue>>;
    public tc: TowerController;
    public economy: EconomyManager;

    constructor(ctx: PickCtx) {
        this.rng = ctx.rng;
        this.unlocked = ctx.unlockedTowers;
        this.tc = ctx.towerController;
        this.economy = ctx.economy;
    }

    /** 返回三选一选项，空数组表示已全部解锁（自动补 100 金币） */
    rollOptions(playerId: string): TowerTypeValue[] {
        const owned = this.unlocked.get(playerId) || new Set<TowerTypeValue>();
        const remaining = (Object.values(TowerType) as TowerTypeValue[]).filter((t) => !owned.has(t));
        if (remaining.length === 0) {
            this.economy.addGold(playerId, 100, 'pick_all_owned');
            return [];
        }
        return this.rng.pickN(remaining, Math.min(3, remaining.length));
    }

    pick(playerId: string, type: TowerTypeValue): void {
        this.tc.unlock(playerId, type);
    }
}
