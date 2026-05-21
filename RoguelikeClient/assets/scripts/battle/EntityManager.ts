/**
 * 实体管理器
 * ---------------------------------------------------------------
 * 集中存放战斗中的所有实体并提供：
 *   - 范围查询：getEnemiesInRange(x, y, range)
 *   - 索引：towers / enemies / minions
 *   - 增删生命周期事件
 */

import { instance as EventBus } from '../core/EventBus';
import { inRange, dist } from '../utils/MathUtils';
import type { Tower } from '../entity/Tower';
import type { Enemy } from '../entity/Enemy';
import type { Minion } from '../entity/Minion';
import type { Crystal } from '../entity/Crystal';

export class EntityManager {
    public towers: Map<string, Tower> = new Map();
    public enemies: Map<string, Enemy> = new Map();
    public minions: Map<string, Minion> = new Map();
    public crystal: Crystal | null = null;

    addTower(tower: Tower): void {
        this.towers.set(tower.id, tower);
        EventBus.emit('tower_add', tower);
    }
    removeTower(id: string): void {
        const t = this.towers.get(id);
        if (t) {
            t.dead = true;
            this.towers.delete(id);
            EventBus.emit('tower_remove', t);
        }
    }

    addEnemy(enemy: Enemy): void {
        this.enemies.set(enemy.id, enemy);
        EventBus.emit('enemy_add', enemy);
    }
    removeEnemy(id: string): void {
        const e = this.enemies.get(id);
        if (e) {
            this.enemies.delete(id);
            EventBus.emit('enemy_remove', e);
        }
    }

    addMinion(m: Minion):    void { this.minions.set(m.id, m); }
    removeMinion(id: string): void { this.minions.delete(id); }

    setCrystal(c: Crystal): void { this.crystal = c; }

    getEnemiesInRange(x: number, y: number, range: number): Enemy[] {
        const r = range;
        const out: Enemy[] = [];
        for (const e of this.enemies.values()) {
            if (e.dead) continue;
            if (inRange(x, y, e.x, e.y, r)) out.push(e);
        }
        return out;
    }

    getTowersInRange(x: number, y: number, range: number): Tower[] {
        const out: Tower[] = [];
        for (const t of this.towers.values()) {
            if (t.dead) continue;
            if (inRange(x, y, t.x, t.y, range)) out.push(t);
        }
        return out;
    }

    getPlayerTowers(playerId: string): Tower[] {
        const out: Tower[] = [];
        for (const t of this.towers.values()) {
            if (!t.dead && t.ownerId === playerId) out.push(t);
        }
        return out;
    }

    clear(): void {
        this.towers.clear();
        this.enemies.clear();
        this.minions.clear();
        this.crystal = null;
    }

    static dist = dist;
}
