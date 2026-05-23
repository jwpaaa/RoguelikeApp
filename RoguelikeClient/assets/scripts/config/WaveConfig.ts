/**
 * 波次配置（来自需求文档 §4.2 F-2.6 / §5.2.2）
 */

import { EnemyType, BossType, type EnemyTypeValue, type BossTypeValue } from '../../shared/index';
import type { SeededRandom } from '../utils/SeededRandom';

export interface WaveSlot {
    type: EnemyTypeValue | 'BOSS';
    count: number;
    isBoss?: boolean;
    bossType?: BossTypeValue;
    batch?: number;
}

interface UnlockInfo {
    first: number;
    every: number;
    weight: number;
}

const UnlockTable: Partial<Record<EnemyTypeValue, UnlockInfo>> = Object.freeze({
    [EnemyType.NORMAL]:   { first: 1,  every: 1, weight: 5 },
    [EnemyType.FAST]:     { first: 2,  every: 2, weight: 2 },
    [EnemyType.FLYING]:   { first: 2,  every: 3, weight: 1 },
    [EnemyType.BOMBER]:   { first: 3,  every: 4, weight: 1 },
    [EnemyType.TANK]:     { first: 3,  every: 3, weight: 2 },
    [EnemyType.HEALER]:   { first: 4,  every: 3, weight: 1 },
    [EnemyType.SPLITTER]: { first: 5,  every: 2, weight: 2 },
    [EnemyType.SHIELD]:   { first: 6,  every: 3, weight: 1 },
    [EnemyType.STEALTH]:  { first: 7,  every: 3, weight: 1 },
    [EnemyType.SUMMONER]: { first: 8,  every: 2, weight: 1 },
    [EnemyType.ELITE]:    { first: 10, every: 2, weight: 1 },
});

const BossSchedule: Record<number, BossTypeValue> = Object.freeze({
    5:  BossType.WOLF_KING,
    10: BossType.ROCK_GIANT,
    15: BossType.SHADOW_LORD,
    20: BossType.DRAGON_KING,
});

export const TOTAL_WAVES = 20;
const BASE_COUNT = 5;
const COUNT_PER_WAVE = 2;

/** 生成第 wave 波的怪物组成（无 BOSS 部分） */
function buildWaveComposition(wave: number, rng: SeededRandom): WaveSlot[] {
    const totalCount = BASE_COUNT + COUNT_PER_WAVE * wave;
    const candidates: { type: EnemyTypeValue; weight: number }[] = [];
    for (const [type, info] of Object.entries(UnlockTable) as Array<[EnemyTypeValue, UnlockInfo]>) {
        if (wave < info.first) continue;
        if ((wave - info.first) % info.every !== 0 && wave !== info.first) continue;
        candidates.push({ type, weight: info.weight });
    }
    if (candidates.length === 0) {
        return [{ type: EnemyType.NORMAL, count: totalCount, batch: 0 }];
    }

    const weights = candidates.map((c) => c.weight);
    const allocated: Partial<Record<EnemyTypeValue, number>> = {};
    for (let i = 0; i < totalCount; i++) {
        const pick = rng.pickWeighted(candidates, weights).type;
        allocated[pick] = (allocated[pick] || 0) + 1;
    }
    return (Object.entries(allocated) as Array<[EnemyTypeValue, number]>).map(([type, count]) => ({ type, count, batch: 0 }));
}

/** 完整波次配置（含 BOSS 波特殊编排） */
export function buildWave(wave: number, rng: SeededRandom): WaveSlot[] {
    const bossType = BossSchedule[wave];
    if (!bossType) return buildWaveComposition(wave, rng);

    const slots: WaveSlot[] = [];
    if (wave === 5) {
        slots.push({ type: EnemyType.NORMAL, count: 4, batch: 0 });
    } else if (wave === 10) {
        slots.push({ type: EnemyType.ELITE, count: 3, batch: 0 });
    } else if (wave === 15) {
        slots.push({ type: EnemyType.SHIELD, count: 4, batch: 0 });
    } else if (wave === 20) {
        slots.push({ type: EnemyType.FAST,  count: 4, batch: 0 });
        slots.push({ type: EnemyType.ELITE, count: 2, batch: 1 });
    }
    slots.push({ type: 'BOSS', count: 1, isBoss: true, bossType, batch: 2 });
    return slots;
}

export function isBossWave(wave: number): boolean {
    return !!BossSchedule[wave];
}

/** 怪物生成节奏（每只之间的间隔，秒） */
export function getSpawnInterval(wave: number): number {
    let interval = 1.5 + 0.1 * wave;
    if (wave === TOTAL_WAVES) interval *= 0.5;
    return interval;
}

/** 同时存活上限 */
export const MAX_CONCURRENT_ENEMIES = 30;

/** 波次结束奖励金币：基础 50 + 波次 × 10 */
export function getWaveRewardGold(wave: number): number {
    return 50 + 10 * wave;
}

// 兼容旧导出
export { UnlockTable, BossSchedule };
