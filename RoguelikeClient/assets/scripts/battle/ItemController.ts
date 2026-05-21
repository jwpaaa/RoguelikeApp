/**
 * 道具控制器（来自需求文档 §F-2.7）
 */

import { ItemConfig, type ItemDef, type ItemTypeValue } from '../config/ItemConfig';
import { TileType, type TileTypeValue } from '../config/MapConfig';
import { instance as EventBus } from '../core/EventBus';
import type { EntityManager } from './EntityManager';
import type { EconomyManager } from './EconomyManager';
import type { Crystal } from '../entity/Crystal';
import type { TowerController } from './TowerController';

export interface ItemCtx {
    entityManager: EntityManager;
    economy: EconomyManager;
    crystal: Crystal;
    map: { tiles: TileTypeValue[][]; width: number; height: number };
    towerController: TowerController;
}

export interface UseResult { ok: boolean; reason?: string; }

interface TempSlotInfo {
    x: number; y: number;
    originTile: TileTypeValue;
    wavesRemaining: number;
    owner: string;
}

export class ItemController {
    public em: EntityManager;
    public economy: EconomyManager;
    public crystal: Crystal;
    public map: ItemCtx['map'];
    public towerCtl: TowerController;

    public bag:       Map<string, Map<string, number>> = new Map();
    public cooldowns: Map<string, number> = new Map();
    public playerEffects: Map<string, { goldDoubleMs?: number }> = new Map();

    private _globalSlowMs: number = 0;
    private _globalSlowPct: number = 0;
    public tempSlots: TempSlotInfo[] = [];

    constructor(ctx: ItemCtx) {
        this.em = ctx.entityManager;
        this.economy = ctx.economy;
        this.crystal = ctx.crystal;
        this.map = ctx.map;
        this.towerCtl = ctx.towerController;
    }

    initPlayer(playerId: string, initialItems?: Record<string, number>): void {
        if (!this.bag.has(playerId)) this.bag.set(playerId, new Map());
        if (initialItems) {
            for (const [id, count] of Object.entries(initialItems)) this.add(playerId, id, count);
        }
    }

    getBag(playerId: string): Record<string, number> {
        const m = this.bag.get(playerId);
        if (!m) return {};
        const out: Record<string, number> = {};
        for (const [k, v] of m) out[k] = v;
        return out;
    }

    add(playerId: string, itemId: string, count: number): boolean {
        const cfg = ItemConfig[itemId as ItemTypeValue];
        if (!cfg) return false;
        if (!this.bag.has(playerId)) this.bag.set(playerId, new Map());
        const m = this.bag.get(playerId)!;
        const cur = m.get(itemId) || 0;
        const next = Math.min(cfg.maxStack, cur + count);
        m.set(itemId, next);
        return next > cur;
    }

    use(playerId: string, itemId: string): UseResult {
        const cfg = ItemConfig[itemId as ItemTypeValue];
        if (!cfg) return { ok: false, reason: 'no_item' };
        const m = this.bag.get(playerId);
        if (!m || !m.get(itemId)) return { ok: false, reason: 'no_stock' };
        const cdKey = playerId + ':' + itemId;
        if ((this.cooldowns.get(cdKey) || 0) > 0) return { ok: false, reason: 'cooldown' };

        m.set(itemId, (m.get(itemId) || 0) - 1);
        this.cooldowns.set(cdKey, cfg.cooldownMs);

        this._applyEffect(playerId, cfg);
        EventBus.emit('item_used', { playerId, itemId, scope: cfg.scope, name: cfg.name });
        return { ok: true };
    }

    private _applyEffect(playerId: string, cfg: ItemDef): void {
        const e = cfg.effect;
        switch (e.kind) {
            case 'GLOBAL_FREEZE': {
                for (const en of this.em.enemies.values()) en.applyFreeze(e.durationMs as number);
                break;
            }
            case 'PLAYER_LIGHTNING': {
                let sum = 0;
                for (const t of this.em.towers.values()) {
                    if (t.dead || t.ownerId !== playerId) continue;
                    if (t.isTotem()) continue;
                    sum += t.getEffectiveAttack();
                }
                const dmg = sum * (e.factor as number);
                for (const en of this.em.enemies.values()) {
                    if (!en.dead) en.takeDamage(dmg, 'MAGIC', playerId);
                }
                break;
            }
            case 'GOLD_DOUBLE': {
                if (!this.playerEffects.has(playerId)) this.playerEffects.set(playerId, {});
                this.playerEffects.get(playerId)!.goldDoubleMs = e.durationMs as number;
                this.economy.addGainMul(playerId, 1.0);
                break;
            }
            case 'TEMP_PLACEABLE': {
                EventBus.emit('item_temp_slot_request', { playerId, wavesAlive: e.wavesAlive });
                break;
            }
            case 'CRYSTAL_SHIELD': {
                this.crystal.addShield(e.layers as number);
                EventBus.emit('crystal_shield_added', { layers: e.layers });
                break;
            }
            case 'GLOBAL_SLOW': {
                this._globalSlowMs = Math.max(this._globalSlowMs, e.durationMs as number);
                this._globalSlowPct = Math.max(this._globalSlowPct, e.slowPct as number);
                for (const en of this.em.enemies.values()) en.applySlow(e.slowPct as number, e.durationMs as number);
                break;
            }
            default: break;
        }
    }

    reserveTempSlot(playerId: string, x: number, y: number, wavesAlive: number): boolean {
        const tile = this.map.tiles[y][x];
        if (tile === TileType.OBSTACLE || tile === TileType.PATH) {
            this.map.tiles[y][x] = TileType.PLACEABLE;
            this.tempSlots.push({ x, y, originTile: TileType.OBSTACLE, wavesRemaining: wavesAlive, owner: playerId });
            return true;
        }
        if (tile === TileType.EMPTY) {
            this.map.tiles[y][x] = TileType.PLACEABLE;
            this.tempSlots.push({ x, y, originTile: TileType.EMPTY, wavesRemaining: wavesAlive, owner: playerId });
            return true;
        }
        return false;
    }

    tick(dtMs: number): void {
        for (const [k, v] of this.cooldowns) {
            const next = v - dtMs;
            if (next <= 0) this.cooldowns.delete(k);
            else this.cooldowns.set(k, next);
        }
        for (const [pid, eff] of this.playerEffects) {
            if (eff.goldDoubleMs && eff.goldDoubleMs > 0) {
                eff.goldDoubleMs -= dtMs;
                if (eff.goldDoubleMs <= 0) {
                    this.economy.addGainMul(pid, -0.5);
                    eff.goldDoubleMs = 0;
                }
            }
        }
        if (this._globalSlowMs > 0) {
            this._globalSlowMs -= dtMs;
            if (this._globalSlowMs <= 0) this._globalSlowPct = 0;
        }
    }

    onWaveEnd(): void {
        for (let i = this.tempSlots.length - 1; i >= 0; i--) {
            const s = this.tempSlots[i];
            s.wavesRemaining--;
            if (s.wavesRemaining <= 0) {
                this.map.tiles[s.y][s.x] = s.originTile;
                this.tempSlots.splice(i, 1);
            }
        }
    }
}
