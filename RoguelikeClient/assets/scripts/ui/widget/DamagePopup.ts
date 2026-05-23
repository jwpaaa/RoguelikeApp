/**
 * 战斗伤害飘字渲染器
 */

import { UINode } from '../core/UINode';
import { instance as UI } from '../core/UIManager';
import { Palette, FontSize, DesignResolution } from '../core/UIConst';
import { DamagePopupManager, PopupKind, type PopupItem, type PopupKindValue } from '../../battle/DamagePopupManager';
import { instance as EventBus } from '../../core/EventBus';

interface PopupStyle {
    color: number;
    size: number;
    prefix: string;
    suffix: string;
}

const STYLE: Record<PopupKindValue, PopupStyle> = {
    [PopupKind.DAMAGE]: { color: Palette.DMG_NORMAL, size: FontSize.SMALL,  prefix: '',    suffix: '' },
    [PopupKind.CRIT]:   { color: Palette.DMG_CRIT,   size: FontSize.LARGE,  prefix: '💥 ', suffix: '!' },
    [PopupKind.DOT]:    { color: Palette.DMG_DOT,    size: FontSize.TINY,   prefix: '-',   suffix: '' },
    [PopupKind.HEAL]:   { color: Palette.DMG_HEAL,   size: FontSize.SMALL,  prefix: '+',   suffix: '' },
    [PopupKind.GOLD]:   { color: Palette.GOLD,       size: FontSize.SMALL,  prefix: '+',   suffix: '💰' },
    [PopupKind.IMMUNE]: { color: Palette.DMG_IMMUNE, size: FontSize.SMALL,  prefix: '',    suffix: '免疫' },
    [PopupKind.SHIELD]: { color: Palette.DMG_SHIELD, size: FontSize.SMALL,  prefix: '',    suffix: '' },
};

const POPUP_DURATION_MS = 800;
const FLOAT_DISTANCE = 40;

export class DamagePopupRenderer {
    public mgr: DamagePopupManager;
    private _designH: number = DesignResolution.HEIGHT;

    constructor() {
        this.mgr = new DamagePopupManager();
        EventBus.on('battle_tick_render', () => this._flush());
        if (typeof setInterval !== 'undefined') setInterval(() => this._flush(), 16);
    }

    private _flush(): void {
        const items = this.mgr.popPending();
        if (items.length === 0) return;
        const layer = UI.getLayer('hud');
        if (!layer) return;
        for (const item of items) this._spawnPopup(layer, item);
    }

    private _spawnPopup(layer: any, item: PopupItem): void {
        const style = STYLE[item.kind] || STYLE[PopupKind.DAMAGE];

        let screenX: number;
        let screenY: number;

        if (item.kind === PopupKind.GOLD) {
            // 金币飘字固定在屏幕中上方，金币标签附近
            screenX = 0;
            screenY = this._designH / 2 - 60;
        } else {
            // 伤害/免疫等飘字跟怪物/塔坐标走
            const cellW = 50;
            const cellH = 33;
            const offX = -(20 * cellW) / 2;
            const offY = -(15 * cellH) / 2;
            screenX = offX + item.x * cellW + cellW / 2;
            screenY = offY + item.y * cellH + cellH / 2;
        }
        let text = style.prefix + (item.value || '') + style.suffix;
        if (item.count > 1) text += ' ×' + item.count;
        const { node } = UINode.label({
            text,
            fontSize: style.size,
            color: style.color,
            pos: { x: screenX, y: screenY },
        });
        layer.addChild(node);

        const startY = screenY;
        const endY = screenY + FLOAT_DISTANCE;
        const startTs = Date.now();
        const tick = setInterval(() => {
            const t = (Date.now() - startTs) / POPUP_DURATION_MS;
            if (t >= 1) {
                clearInterval(tick);
                node.destroy();
                return;
            }
            node.setPosition(screenX, startY + (endY - startY) * t);
        }, 16);
    }
}
