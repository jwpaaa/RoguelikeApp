/**
 * 道具栏（HUD 底部）
 */

import { UIBase } from '../core/UIBase';
import { Node } from 'cc';
import { UINode } from '../core/UINode';
import { instance as UI } from '../core/UIManager';
import { Palette, FontSize, DesignResolution } from '../core/UIConst';
import { ItemConfig, ItemType, type ItemTypeValue } from '../../config/ItemConfig';
import { Toast } from '../widget/Toast';
import type { BattleManager } from '../../battle/BattleManager';
import type { cc } from '../core/CocosAdapter';

const SLOT_SIZE = 60;
const SLOT_GAP = 8;

interface SlotData {
    itemId: ItemTypeValue;
    node: cc.Node;
    cntLbl: cc.Label;
    cdLbl: cc.Label;
}

export interface ItemBarCtx {
    playerId: string;
    battle: BattleManager;
}

export class ItemBar extends UIBase {
    public playerId: string;
    public battle: BattleManager;
    public slots: SlotData[] = [];
    private _cdTimer: ReturnType<typeof setInterval> | null = null;

    constructor(ctx: ItemBarCtx) {
        super({});
        this.playerId = ctx.playerId;
        this.battle = ctx.battle;
        this._build();
        this._bind();
    }

    private _build(): void {
        const layer = UI.getLayer('hud');
        if (!layer) return;
        const bar = UINode.panel({
            name: 'ItemBarBg',
            size: { w: DesignResolution.WIDTH, h: SLOT_SIZE + 20 },
            color: '1A1A2ECC',
            pos: { x: 0, y: -DesignResolution.HEIGHT / 2 + SLOT_SIZE / 2 + 10 },
        });
        layer.addChild(bar);

        const row = UINode.row({
            name: 'ItemBar',
            gap: SLOT_GAP,
        });
        bar.addChild(row.node);
        this.node = row.node;

        const allTypes = Object.values(ItemType) as ItemTypeValue[];
        for (const itemId of allTypes) {
            const slot = this._makeSlot(itemId);
            this.node.addChild(slot.node);
            this.slots.push(slot);
        }
        this._refresh();
    }

    private _makeSlot(itemId: ItemTypeValue): SlotData {
        const cfg = ItemConfig[itemId];
        const node = UINode.panel({
            name: 'Slot_' + itemId,
            size: { w: SLOT_SIZE, h: SLOT_SIZE },
            color: Palette.PANEL_BG,
        });
        const { node: iconNode } = UINode.label({
            text: cfg.icon || '?',
            fontSize: FontSize.LARGE,
            color: Palette.WHITE,
        });
        node.addChild(iconNode);
        const { node: cntNode, label: cntLbl } = UINode.label({
            text: '0',
            fontSize: FontSize.SMALL,
            color: Palette.GOLD,
            pos: { x: SLOT_SIZE / 2 - 8, y: -SLOT_SIZE / 2 + 8 },
        });
        node.addChild(cntNode);
        const { node: cdNode, label: cdLbl } = UINode.label({
            text: '',
            fontSize: FontSize.SMALL,
            color: Palette.RED,
            pos: { x: 0, y: 0 },
        });
        node.addChild(cdNode);

        const btn = node.addComponent('cc.Button' as any);
        if (btn) btn.transition = (cc as any).Button?.Transition?.NONE || 0;
        node.on(Node.EventType.TOUCH_END, () => {
            const r = this.battle.useItem(this.playerId, itemId);
            if (!r || !r.ok) {
                const msg = r?.reason === 'cooldown' ? '正在冷却，请稍等' : (r?.reason || '使用失败');
                Toast.warn(msg);
            } else {
                Toast.show(`${cfg.name}: ${cfg.desc}`, { duration: 2500 });
            }
        });
        return { itemId, node, cntLbl, cdLbl };
    }

    private _bind(): void {
        this.listen('item_used',     () => this._refresh());
        this.listen('shop_bought',   () => this._refresh());
        this.listen('economy_change',() => this._refresh());
        this._cdTimer = setInterval(() => this._refreshCooldowns(), 500);
    }

    private _refresh(): void {
        const bag = this.battle.itemCtl.getBag(this.playerId);
        for (const s of this.slots) {
            const cnt = bag[s.itemId] || 0;
            s.cntLbl.string = String(cnt);
        }
        this._refreshCooldowns();
    }

    private _refreshCooldowns(): void {
        for (const s of this.slots) {
            const key = this.playerId + ':' + s.itemId;
            const cd = this.battle.itemCtl.cooldowns.get(key) || 0;
            s.cdLbl.string = cd > 0 ? Math.ceil(cd / 1000) + 's' : '';
        }
    }

    onDestroy(): void {
        if (this._cdTimer) clearInterval(this._cdTimer);
    }
}
