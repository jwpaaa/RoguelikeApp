/**
 * 战斗伤害飘字数据层（来自需求文档 §F-2.2.2）
 * ---------------------------------------------------------------
 * 同帧合并：相同坐标同类型自动累加 ×N
 */

import { instance as EventBus } from '../core/EventBus';

export const PopupKind = Object.freeze({
    DAMAGE: 'damage',
    CRIT:   'crit',
    DOT:    'dot',
    HEAL:   'heal',
    GOLD:   'gold',
    IMMUNE: 'immune',
    SHIELD: 'shield',
});

export type PopupKindValue = typeof PopupKind[keyof typeof PopupKind];

export interface PopupItem {
    kind: PopupKindValue;
    x: number;
    y: number;
    value: number;
    count: number;
}

export class DamagePopupManager {
    private _frameBuffer: Map<string, PopupItem> = new Map();

    constructor() {
        EventBus.on('bullet_fired', (data: { tower: any; target: any; raw: number; crit: boolean }) => this._onBullet(data));
        EventBus.on('crystal_damaged', (data: { dmg: number }) => this._push(PopupKind.SHIELD, 0, 0, data.dmg));
        EventBus.on('enemy_killed', (e: any) => this._push(PopupKind.GOLD, e.x, e.y, e.reward));
    }

    private _onBullet({ target, raw, crit }: { target: any; raw: number; crit: boolean }): void {
        const kind = crit ? PopupKind.CRIT : PopupKind.DAMAGE;
        this._push(kind, target.x, target.y, Math.round(raw));
    }

    private _push(kind: PopupKindValue, x: number, y: number, value: number): void {
        const k = kind + '|' + Math.round(x) + '|' + Math.round(y);
        const item = this._frameBuffer.get(k);
        if (item) {
            item.value += value;
            item.count++;
        } else {
            this._frameBuffer.set(k, { kind, x, y, value, count: 1 });
        }
    }

    /** 渲染层每帧调用 */
    popPending(): PopupItem[] {
        const out = Array.from(this._frameBuffer.values());
        this._frameBuffer.clear();
        return out;
    }
}
