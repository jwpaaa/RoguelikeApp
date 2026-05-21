/**
 * 塔目标选择 AI（5 种优先级模式 — F-2.2.1）
 */

import { TargetMode } from '@rtd/shared';
import { distSq } from '../utils/MathUtils';
import type { Tower } from '../entity/Tower';
import type { Enemy } from '../entity/Enemy';

export class TowerAI {
    /** 按 tower.targetMode 选择目标 */
    static pickTarget(tower: Tower, candidates: Enemy[]): Enemy | null {
        if (!candidates || candidates.length === 0) return null;
        switch (tower.targetMode) {
            case TargetMode.LAST:
                return candidates.reduce((b, c) => (b.pathIndex < c.pathIndex ? b : c));
            case TargetMode.STRONG:
                return candidates.reduce((b, c) => (b.hp >= c.hp ? b : c));
            case TargetMode.WEAK:
                return candidates.reduce((b, c) => (b.hp <= c.hp ? b : c));
            case TargetMode.CLOSE: {
                let best = candidates[0];
                let bestD = distSq(tower.x, tower.y, best.x, best.y);
                for (let i = 1; i < candidates.length; i++) {
                    const d = distSq(tower.x, tower.y, candidates[i].x, candidates[i].y);
                    if (d < bestD) { bestD = d; best = candidates[i]; }
                }
                return best;
            }
            case TargetMode.FIRST:
            default:
                return candidates.reduce((b, c) => (b.pathIndex >= c.pathIndex ? b : c));
        }
    }

    /**
     * 过滤可锁定目标：
     *   - 非对空塔：飞行怪不可锁
     *   - 隐行怪：仅有反隐能力时可锁
     */
    static filterLockable(tower: Tower, enemies: Enemy[]): Enemy[] {
        const detect = tower.canDetectStealth();
        return enemies.filter((e) => {
            if (e.dead) return false;
            if (e.flying) {
                if (tower.type !== 'ARROW' && tower.type !== 'MAGIC' && tower.type !== 'TESLA') return false;
            }
            if (e.stealth && !detect) return false;
            return true;
        });
    }
}
