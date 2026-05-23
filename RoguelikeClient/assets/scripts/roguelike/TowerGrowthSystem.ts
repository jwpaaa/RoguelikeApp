/**
 * 塔属性自动成长（来自需求文档 §F-3.2）
 */

import { TowerConfig } from '../../shared/index';
import type { EntityManager } from '../battle/EntityManager';

export interface GrowthCtx {
    entityManager: EntityManager;
    growthMul?: number;
}

export class TowerGrowthSystem {
    public em: EntityManager;
    public growthMul: number;

    constructor(ctx: GrowthCtx) {
        this.em = ctx.entityManager;
        this.growthMul = ctx.growthMul || 1;
    }

    apply(waveNumber: number): void {
        for (const tower of this.em.towers.values()) {
            if (tower.dead) continue;
            const cfg = TowerConfig[tower.type];
            if (!cfg) continue;
            const { perWave, everyN } = cfg.growth;
            for (const [k, v] of Object.entries(perWave) as Array<[string, number]>) {
                tower.growth[k] = (tower.growth[k] || 0) + v * this.growthMul;
            }
            if (everyN && waveNumber % everyN.n === 0) {
                for (const [k, v] of Object.entries(everyN.attrs) as Array<[string, number]>) {
                    tower.growth[k] = (tower.growth[k] || 0) + v * this.growthMul;
                }
            }
        }
    }
}
