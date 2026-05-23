/**
 * 防御塔控制器（建造/升级/出售/目标模式切换）
 */

import { Tower } from '../entity/Tower';
import { TowerConfig, TargetMode, type TowerTypeValue, type TargetModeValue } from '../../shared/index';
import { TileType, type TileTypeValue } from '../config/MapConfig';
import { instance as EventBus } from '../core/EventBus';
import type { EntityManager } from './EntityManager';
import type { EconomyManager } from './EconomyManager';

export interface MapShape {
    tiles: TileTypeValue[][];
    width: number;
    height: number;
}

export interface TowerControllerCtx {
    entityManager:  EntityManager;
    economy:        EconomyManager;
    map:            MapShape;
    unlockedTowers: Map<string, Set<TowerTypeValue>>;
    towerLimit:     Map<string, number>;
}

export interface OpResult {
    ok: boolean;
    reason?: string;
    refund?: number;
    tower?: Tower;
    lostBuffs?: unknown[];
    growthWarn?: boolean;
}

export class TowerController {
    public em: EntityManager;
    public economy: EconomyManager;
    public map: MapShape;
    public unlocked: Map<string, Set<TowerTypeValue>>;
    public towerLimit: Map<string, number>;
    public occupied: Map<string, string> = new Map();
    public targetModeUnlocked: Set<string> = new Set();
    public actualSpent: Map<string, number> = new Map();

    constructor(ctx: TowerControllerCtx) {
        this.em = ctx.entityManager;
        this.economy = ctx.economy;
        this.map = ctx.map;
        this.unlocked = ctx.unlockedTowers;
        this.towerLimit = ctx.towerLimit;
    }

    canBuild(playerId: string, type: TowerTypeValue, x: number, y: number): OpResult {
        if (!this._inBounds(x, y)) return { ok: false, reason: 'oob' };
        if (this.map.tiles[y][x] !== TileType.PLACEABLE) return { ok: false, reason: 'tile' };
        if (this.occupied.has(`${x},${y}`)) return { ok: false, reason: 'occupied' };
        const unlock = this.unlocked.get(playerId);
        if (!unlock || !unlock.has(type)) return { ok: false, reason: 'locked' };
        const cfg = TowerConfig[type];
        if (!cfg) return { ok: false, reason: 'no_type' };
        if (!this.economy.canAfford(playerId, cfg.levels[0].cost)) return { ok: false, reason: 'gold' };
        const limit = this.towerLimit.get(playerId);
        if (limit && this.em.getPlayerTowers(playerId).length >= limit) return { ok: false, reason: 'limit' };
        return { ok: true };
    }

    build(playerId: string, type: TowerTypeValue, x: number, y: number): OpResult {
        const ck = this.canBuild(playerId, type, x, y);
        if (!ck.ok) return ck;
        const cfg = TowerConfig[type];
        const realCost = this.economy.spend(playerId, cfg.levels[0].cost, 'build');
        if (realCost < 0) return { ok: false, reason: 'gold' };
        const tower = new Tower({ ownerId: playerId, type, x, y, level: 1, targetMode: TargetMode.FIRST });
        this.em.addTower(tower);
        this.occupied.set(`${x},${y}`, tower.id);
        this.actualSpent.set(tower.id, realCost);
        EventBus.emit('tower_built', tower);
        return { ok: true, tower };
    }

    upgrade(playerId: string, towerId: string): OpResult {
        const t = this.em.towers.get(towerId);
        if (!t || t.dead) return { ok: false, reason: 'no_tower' };
        if (t.ownerId !== playerId) return { ok: false, reason: 'not_owner' };
        const cfg = TowerConfig[t.type];
        if (t.level >= cfg.levels.length) return { ok: false, reason: 'max_level' };
        const cost = cfg.levels[t.level].cost;
        if (!this.economy.canAfford(playerId, cost)) return { ok: false, reason: 'gold' };
        const real = this.economy.spend(playerId, cost, 'upgrade');
        t.level += 1;
        this.actualSpent.set(t.id, (this.actualSpent.get(t.id) || 0) + real);
        EventBus.emit('tower_upgraded', t);
        return { ok: true };
    }

    /** 出售（实际花费 × 50% 返还，含 §5.1.9 lostBuffs / growthWarn） */
    sell(playerId: string, towerId: string): OpResult {
        const t = this.em.towers.get(towerId);
        if (!t || t.dead) return { ok: false, reason: 'no_tower' };
        if (t.ownerId !== playerId) return { ok: false, reason: 'not_owner' };
        const spent = this.actualSpent.get(t.id) || 0;
        const refund = Math.floor(spent * 0.5);
        const lostBuffs = (t.buffs || []).slice();
        const growthWarn = Object.values(t.growth || {}).some((v) => Math.abs(v) > 0);
        this.economy.addGold(playerId, refund, 'sell');
        this.occupied.delete(`${t.x},${t.y}`);
        this.actualSpent.delete(t.id);
        this.em.removeTower(t.id);
        EventBus.emit('tower_sold', { tower: t, refund, lostBuffs, growthWarn });
        return { ok: true, refund, lostBuffs, growthWarn };
    }

    switchTargetMode(playerId: string, towerId: string, mode: TargetModeValue): OpResult {
        if (!this.targetModeUnlocked.has(playerId)) return { ok: false, reason: 'locked_talent' };
        if (!Object.values(TargetMode).includes(mode as TargetModeValue)) return { ok: false, reason: 'bad_mode' };
        const t = this.em.towers.get(towerId);
        if (!t || t.dead) return { ok: false, reason: 'no_tower' };
        if (t.ownerId !== playerId) return { ok: false, reason: 'not_owner' };
        t.targetMode = mode;
        EventBus.emit('tower_mode_changed', t);
        return { ok: true };
    }

    unlock(playerId: string, type: TowerTypeValue): void {
        if (!this.unlocked.has(playerId)) this.unlocked.set(playerId, new Set());
        this.unlocked.get(playerId)!.add(type);
    }

    private _inBounds(x: number, y: number): boolean {
        return x >= 0 && x < this.map.width && y >= 0 && y < this.map.height;
    }
}
