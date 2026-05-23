/**
 * AI 托管（来自需求文档 §F-1.4 / §F-4.6）
 */

import { TileType } from '../config/MapConfig';
import { TowerType, TowerConfig, type TowerTypeValue } from '../../shared/index';
import { instance as EventBus } from '../core/EventBus';
import type { BattleManager } from './BattleManager';

const THINK_INTERVAL_MS = 1500;

export interface AutoCtx {
    playerId: string;
    battle: BattleManager;
    mode?: 'TAKEOVER' | 'AI_FILL';
}

export class AutoTowerAI {
    public playerId: string;
    public battle: BattleManager;
    public mode: 'TAKEOVER' | 'AI_FILL';
    private _accMs: number = 0;
    private _enabled: boolean = true;

    constructor(ctx: AutoCtx) {
        this.playerId = ctx.playerId;
        this.battle = ctx.battle;
        this.mode = ctx.mode || 'AI_FILL';
    }

    enable(): void  { this._enabled = true;  EventBus.emit('ai_takeover_on',  { playerId: this.playerId, mode: this.mode }); }
    disable(): void { this._enabled = false; EventBus.emit('ai_takeover_off', { playerId: this.playerId }); }

    tick(dtMs: number): void {
        if (!this._enabled) return;
        this._accMs += dtMs;
        if (this._accMs < THINK_INTERVAL_MS) return;
        this._accMs = 0;
        this._think();
    }

    private _think(): void {
        const battle = this.battle;
        const pid = this.playerId;
        const myTowers = battle.em.getPlayerTowers(pid);

        // 优先升级最低等级且可升级的塔
        const upgradable = myTowers
            .filter((t) => t.level < TowerConfig[t.type].levels.length)
            .sort((a, b) => a.level - b.level);
        for (const t of upgradable) {
            const r = battle.upgrade(pid, t.id);
            if (r.ok) return;
        }

        if (this.mode === 'TAKEOVER') return;

        // 找一个靠路径近的 PLACEABLE 格建塔
        const map = battle.map;
        let best: { x: number; y: number } | null = null;
        let bestD = Infinity;
        const occupied = new Set<string>();
        for (const t of battle.em.towers.values()) occupied.add(t.x + ',' + t.y);
        for (let y = 0; y < map.height; y++) {
            for (let x = 0; x < map.width; x++) {
                if (map.tiles[y][x] !== TileType.PLACEABLE) continue;
                if (occupied.has(x + ',' + y)) continue;
                let minD = Infinity;
                for (const p of map.path) {
                    const dx = p.x - x;
                    const dy = p.y - y;
                    const d = dx * dx + dy * dy;
                    if (d < minD) minD = d;
                }
                if (minD < bestD) { bestD = minD; best = { x, y }; }
            }
        }
        if (!best) return;

        const unlocked = Array.from(battle.unlockedTowers.get(pid) || []);
        if (unlocked.length === 0) return;
        const preferred = [TowerType.ARROW, TowerType.CANNON, TowerType.ICE].filter((t) => unlocked.includes(t)) as TowerTypeValue[];
        const candidates = preferred.length > 0 ? preferred : unlocked;
        for (const type of candidates) {
            const r = battle.build(pid, type as TowerTypeValue, best.x, best.y);
            if (r.ok) return;
        }
    }
}
