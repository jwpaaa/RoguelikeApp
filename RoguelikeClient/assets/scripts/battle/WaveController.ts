/**
 * 波次控制器
 */

import { Enemy } from '../entity/Enemy';
import { buildWave, getSpawnInterval, MAX_CONCURRENT_ENEMIES, isBossWave, getWaveRewardGold, type WaveSlot } from '../config/WaveConfig';
import { instance as EventBus } from '../core/EventBus';
import type { EntityManager } from './EntityManager';
import type { SeededRandom } from '../utils/SeededRandom';
import type { Pt } from '../map/AStarPathfinding';
import type { EnemyWaveMod } from './BuffManager';

export interface WaveCtx {
    entityManager: EntityManager;
    rng: SeededRandom;
    path: Pt[];
    difficultyMod: { enemyHpMul: number; enemySpeedMul: number; waveRewardMul: number };
    multiplayerMod: { enemyHpMul: number; enemyCountMul: number };
    getEnemyWaveBuff: () => EnemyWaveMod;
}

export class WaveController {
    public em: EntityManager;
    public rng: SeededRandom;
    public path: Pt[];
    public difficultyMod: WaveCtx['difficultyMod'];
    public mpMod: WaveCtx['multiplayerMod'];
    public getEnemyWaveBuff: () => EnemyWaveMod;

    public currentWave: number = 0;
    public queue: WaveSlot[] = [];
    public waveBuff: EnemyWaveMod | null = null;

    private _spawnAccMs: number = 0;
    private _spawnIntervalMs: number = 1500;
    private _totalToSpawn: number = 0;
    private _spawnedCount: number = 0;
    private _waveActive: boolean = false;
    private _waveTotalKilled: number = 0;
    private _waveTotalSpawned: number = 0;

    constructor(ctx: WaveCtx) {
        this.em = ctx.entityManager;
        this.rng = ctx.rng;
        this.path = ctx.path;
        this.difficultyMod = ctx.difficultyMod;
        this.mpMod = ctx.multiplayerMod;
        this.getEnemyWaveBuff = ctx.getEnemyWaveBuff;
    }

    isWaveActive(): boolean { return this._waveActive; }
    get totalSpawned(): number { return this._waveTotalSpawned; }
    get totalKilled():  number { return this._waveTotalKilled; }

    startWave(wave: number): void {
        this.currentWave = wave;
        this.waveBuff = this.getEnemyWaveBuff();
        this.queue = buildWave(wave, this.rng);

        const countMul = (1 + (this.waveBuff.countPct || 0)) * (this.mpMod.enemyCountMul || 1);
        for (const slot of this.queue) {
            if (!slot.isBoss) slot.count = Math.max(1, Math.round(slot.count * countMul));
        }

        this._totalToSpawn = this.queue.reduce((s, x) => s + x.count, 0);
        this._spawnedCount = 0;
        this._waveTotalSpawned = this._totalToSpawn;
        this._waveTotalKilled  = 0;
        this._spawnIntervalMs = Math.round(getSpawnInterval(wave) * 1000);
        this._spawnAccMs = this._spawnIntervalMs;
        this._waveActive = true;
        EventBus.emit('wave_start', { wave });
    }

    isWaveCompleted(): boolean {
        return this._waveActive && this._spawnedCount >= this._totalToSpawn && this.em.enemies.size === 0;
    }

    tick(dtMs: number): void {
        if (!this._waveActive) return;

        if (this._spawnedCount < this._totalToSpawn && this.em.enemies.size < MAX_CONCURRENT_ENEMIES) {
            this._spawnAccMs += dtMs;
            while (this._spawnAccMs >= this._spawnIntervalMs && this._spawnedCount < this._totalToSpawn) {
                this._spawnNext();
                this._spawnAccMs -= this._spawnIntervalMs;
                if (this.em.enemies.size >= MAX_CONCURRENT_ENEMIES) break;
            }
        }

        if (this.isWaveCompleted()) {
            this._waveActive = false;
            EventBus.emit('wave_end', {
                wave: this.currentWave,
                killed: this._waveTotalKilled,
                spawned: this._waveTotalSpawned,
                rewardGold: getWaveRewardGold(this.currentWave) * (this.difficultyMod.waveRewardMul || 1),
                isBoss: isBossWave(this.currentWave),
            });
        }
    }

    private _spawnNext(): void {
        for (const slot of this.queue) {
            if (slot.count > 0) {
                this._spawnEnemy(slot);
                slot.count--;
                this._spawnedCount++;
                return;
            }
        }
    }

    private _spawnEnemy(slot: WaveSlot): void {
        const wave = this.currentWave;
        const buff = this.waveBuff || ({} as EnemyWaveMod);
        const elite = !!buff.elite && this.rng.next() < 0.5;
        if (buff.elite) buff.elite = false; // 仅一次

        const enemy = new Enemy({
            type: slot.isBoss ? 'BOSS' : slot.type,
            wave,
            path: this.path,
            bossType: slot.bossType,
            hpMul: this.difficultyMod.enemyHpMul * this.mpMod.enemyHpMul,
            speedMul: this.difficultyMod.enemySpeedMul * (1 + (buff.speedPct || 0)),
            armorAdd: buff.armorAdd || 0,
            regenPct: buff.regenPct || 0,
            dmgAdd: buff.dmgAdd || 0,
            elite,
            hpDeltaPct: buff.hpDeltaPct || 0,
            takenDmgPct: buff.takenDmgPct || 0,
            confusePct: buff.confusePct || 0,
            paralyze: !!buff.paralyze,
        });
        this.em.addEnemy(enemy);
    }

    onEnemyKilled(): void { this._waveTotalKilled++; }
}
