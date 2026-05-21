/**
 * 子弹/伤害结算控制器
 * ---------------------------------------------------------------
 * "瞬时命中"模型：塔触发攻击 → fire() → 立刻结算
 */

import { DamageCalculator } from './DamageCalculator';
import { instance as EventBus } from '../core/EventBus';
import { dist } from '../utils/MathUtils';
import type { SeededRandom } from '../utils/SeededRandom';
import type { EntityManager } from './EntityManager';
import type { Tower, GlobalMod, AuraMod } from '../entity/Tower';
import type { Enemy, DamageTypeStr } from '../entity/Enemy';

export interface BulletCtx {
    entityManager: EntityManager;
    rng: SeededRandom;
}

export interface FireMods {
    globalMod?: GlobalMod;
    auraMod?:   AuraMod;
}

export class BulletController {
    public em: EntityManager;
    public rng: SeededRandom;

    constructor(ctx: BulletCtx) {
        this.em = ctx.entityManager;
        this.rng = ctx.rng;
    }

    fire(tower: Tower, target: Enemy, mods: FireMods): void {
        const { globalMod, auraMod } = mods;
        const atk = tower.getEffectiveAttack(globalMod, auraMod);
        const critRate = tower.getCritRate(globalMod);
        const critDmg  = tower.getCritDamage(globalMod);
        const { raw, crit } = DamageCalculator.computeOutgoing({ atk, critRate, critDmg, rng: this.rng });

        EventBus.emit('bullet_fired', { tower, target, raw, crit });

        switch (tower.type) {
            case 'ARROW':  this._fireArrow(tower, target, raw); break;
            case 'CANNON': this._fireCannon(tower, target, raw); break;
            case 'ICE':    this._fireIce(tower, target, raw); break;
            case 'MAGIC':  this._fireMagic(tower, target, raw); break;
            case 'POISON': this._firePoison(tower, target, raw); break;
            case 'TESLA':  this._fireTesla(tower, target, raw); break;
            default:       this._defaultHit(tower, target, raw, 'PHYSICAL');
        }
    }

    private _defaultHit(tower: Tower, target: Enemy, raw: number, dmgType: DamageTypeStr): void {
        target.takeDamage(raw, dmgType, tower.ownerId);
    }

    private _fireArrow(tower: Tower, target: Enemy, raw: number): void {
        target.takeDamage(raw, 'PHYSICAL', tower.ownerId);
        if (tower.level === 3 && this.rng.next() < 0.20) {
            target.takeDamage(raw, 'PHYSICAL', tower.ownerId);
        }
    }

    private _fireCannon(tower: Tower, target: Enemy, raw: number): void {
        const stat = tower.getLevelStat();
        const splashR = (stat.splash || 0) + (tower.growth.splash || 0);
        const targets = this.em.getEnemiesInRange(target.x, target.y, splashR);
        for (const t of targets) {
            t.takeDamage(raw, 'PHYSICAL', tower.ownerId);
            if (tower.level === 3) t.applyFreeze(800);
        }
    }

    private _fireIce(tower: Tower, target: Enemy, raw: number): void {
        const stat = tower.getLevelStat();
        target.takeDamage(raw, 'MAGIC', tower.ownerId);
        const slow = (stat.slow || 0) + (tower.growth.slow || 0);
        const slowDur = ((stat.slowDur || 0) + (tower.growth.slowDur || 0)) * 1000;
        target.applySlow(slow, slowDur);
        if (tower.level === 3 && this.rng.next() < 0.15) target.applyFreeze(1500);
    }

    private _fireMagic(tower: Tower, target: Enemy, raw: number): void {
        const stat = tower.getLevelStat();
        const pierce = (stat.pierce || 0) + (tower.growth.pierce || 0);
        const candidates = this.em.getEnemiesInRange(tower.x, tower.y, tower.getEffectiveRange());
        candidates.sort((a, b) => b.pathIndex - a.pathIndex);
        let count = 0;
        for (const e of candidates) {
            if (count >= pierce) break;
            const isShield = e.shield > 0;
            let dmg = raw;
            if (tower.level === 3 && isShield) dmg *= 3;
            e.takeDamage(dmg, 'MAGIC', tower.ownerId);
            count++;
        }
        // 抑制 target 未使用
        void target;
    }

    private _firePoison(tower: Tower, target: Enemy, raw: number): void {
        const stat = tower.getLevelStat();
        target.takeDamage(raw, 'PHYSICAL', tower.ownerId);
        const dot = (stat.dot || 0) + (tower.growth.dot || 0);
        const dur = ((stat.dotDur || 0) + (tower.growth.dotDur || 0)) * 1000;
        const max = (stat.maxStack || 0) + (tower.growth.maxStack || 0);
        target.addDot(dot, dur, max);
        if (tower.level === 3 && target.dotStacks.length >= max) {
            const total = target.dotStacks.reduce((s, x) => s + x.dotPerSec, 0);
            const aoe = total * 0.5;
            const targets = this.em.getEnemiesInRange(target.x, target.y, 2);
            for (const t of targets) t.takeDamage(aoe, 'TRUE', tower.ownerId);
            target.dotStacks.length = 0;
        }
    }

    private _fireTesla(tower: Tower, target: Enemy, raw: number): void {
        const stat = tower.getLevelStat();
        const chainCount = (stat.chain || 0) + (tower.growth.chain || 0);
        const decay = stat.chainDecay || 0.20;
        const visited = new Set<string>([target.id]);
        let cur: Enemy | null = target;
        for (let i = 0; i < chainCount && cur; i++) {
            const dmg = DamageCalculator.chainDamage(raw, decay, i);
            cur.takeDamage(dmg, 'MAGIC', tower.ownerId);
            if (tower.level === 3) cur.applyFreeze(500);
            const others = this.em.getEnemiesInRange(cur.x, cur.y, 2.5)
                .filter((e) => !visited.has(e.id));
            if (others.length === 0) break;
            const curRef = cur;
            others.sort((a, b) => dist(curRef.x, curRef.y, a.x, a.y) - dist(curRef.x, curRef.y, b.x, b.y));
            cur = others[0];
            visited.add(cur.id);
        }
    }
}
