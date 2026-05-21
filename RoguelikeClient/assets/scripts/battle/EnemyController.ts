/**
 * 怪物控制器：移动 / 状态推进 / 攻击水晶 / 死亡奖励
 */

import { instance as EventBus } from '../core/EventBus';
import { Enemy } from '../entity/Enemy';
import type { EntityManager } from './EntityManager';
import type { EconomyManager } from './EconomyManager';
import type { Crystal } from '../entity/Crystal';
import type { SeededRandom } from '../utils/SeededRandom';

export interface EnemyCtx {
    entityManager: EntityManager;
    economy: EconomyManager;
    crystal: Crystal;
    rng: SeededRandom;
}

export class EnemyController {
    public em: EntityManager;
    public economy: EconomyManager;
    public crystal: Crystal;
    public rng: SeededRandom;
    private _regenAccMs: number = 0;
    private _healerAccMs: number = 0;

    constructor(ctx: EnemyCtx) {
        this.em = ctx.entityManager;
        this.economy = ctx.economy;
        this.crystal = ctx.crystal;
        this.rng = ctx.rng;
    }

    tick(dtMs: number): { deaths: number; leaks: number } {
        let deaths = 0;
        let leaks  = 0;
        this._regenAccMs  += dtMs;
        this._healerAccMs += dtMs;
        const regenTick  = this._regenAccMs >= 1000;
        const healerTick = this._healerAccMs >= 3000;
        if (regenTick)  this._regenAccMs = 0;
        if (healerTick) this._healerAccMs = 0;

        for (const e of Array.from(this.em.enemies.values())) {
            // 已死亡 → 立即处理并移除
            if (e.dead) {
                this._onKilled(e);
                deaths++;
                continue;
            }
            this._tickStatus(e, dtMs, regenTick);
            if (e.hp <= 0) {
                e.dead = true;
                this._onKilled(e);
                deaths++;
                continue;
            }
            if (healerTick && e.ability === 'heal') {
                this._healerHeal(e);
            }
            // 移动
            const speed = e.getSpeed();
            if (speed > 0) {
                e.segProgress += speed;
                while (e.segProgress >= 1 && e.pathIndex < e.path.length - 1) {
                    e.pathIndex++;
                    e.segProgress -= 1;
                    const np = e.path[e.pathIndex];
                    e.x = np.x; e.y = np.y;
                }
                if (e.pathIndex < e.path.length - 1) {
                    const a = e.path[e.pathIndex];
                    const b = e.path[e.pathIndex + 1];
                    e.x = a.x + (b.x - a.x) * e.segProgress;
                    e.y = a.y + (b.y - a.y) * e.segProgress;
                } else {
                    const last = e.path[e.path.length - 1];
                    e.x = last.x; e.y = last.y;
                }
            }
            // 到达终点
            if (e.pathIndex >= e.path.length - 1 && e.segProgress >= 0.95) {
                e.reachedEnd = true;
                this.crystal.takeDamage(e.dmgToCrystal);
                EventBus.emit('crystal_damaged', { dmg: e.dmgToCrystal, crystal: this.crystal });
                this.em.removeEnemy(e.id);
                leaks++;
            }
        }
        return { deaths, leaks };
    }

    private _tickStatus(e: Enemy, dtMs: number, regenTick: boolean): void {
        // DOT
        if (e.dotStacks.length > 0) {
            for (let i = e.dotStacks.length - 1; i >= 0; i--) {
                const s = e.dotStacks[i];
                const dmg = s.dotPerSec * dtMs / 1000;
                if (dmg > 0) e.takeDamage(dmg, 'TRUE');
                s.remainMs -= dtMs;
                if (s.remainMs <= 0) e.dotStacks.splice(i, 1);
            }
        }
        // 减速倒计时
        if (e.slowRemainMs > 0) {
            e.slowRemainMs -= dtMs;
            if (e.slowRemainMs <= 0) {
                e.slowMul = 1;
                e.slowRemainMs = 0;
            }
        }
        // 冰冻倒计时
        if (e.frozenMs > 0) e.frozenMs = Math.max(0, e.frozenMs - dtMs);
        // 麻痹（D-05）
        if (e.paralyze) {
            e.paralyzeAccMs += dtMs;
            if (e.paralyzeAccMs >= 3000) {
                e.applyFreeze(500);
                e.paralyzeAccMs = 0;
            }
        }
        // 再生（M-06）
        if (regenTick && e.regenPct > 0) {
            const heal = Math.round(e.maxHp * e.regenPct);
            e.hp = Math.min(e.maxHp, e.hp + heal);
        }
    }

    private _healerHeal(healer: Enemy): void {
        const range = 3;
        const targets = this.em.getEnemiesInRange(healer.x, healer.y, range);
        for (const t of targets) {
            if (t.id === healer.id) continue;
            t.hp = Math.min(t.maxHp, t.hp + Math.round(t.maxHp * 0.20));
        }
        EventBus.emit('enemy_healed', healer);
    }

    private _onKilled(e: Enemy): void {
        if (e.lastHitBy) {
            this.economy.addGold(e.lastHitBy, e.reward, 'kill');
        }
        // 分裂
        if (e.ability === 'split' && !e.isBoss) {
            this._spawnSplits(e);
        }
        EventBus.emit('enemy_killed', e);
        this.em.removeEnemy(e.id);
    }

    private _spawnSplits(parent: Enemy): void {
        for (let i = 0; i < 2; i++) {
            const child = new Enemy({
                type: 'NORMAL',
                wave: 1,
                path: parent.path,
                hpMul: 0.5,
            });
            child.maxHp = Math.round(parent.maxHp * 0.5);
            child.hp = child.maxHp;
            child.pathIndex = parent.pathIndex;
            child.segProgress = parent.segProgress;
            child.x = parent.x;
            child.y = parent.y;
            this.em.addEnemy(child);
        }
    }
}
