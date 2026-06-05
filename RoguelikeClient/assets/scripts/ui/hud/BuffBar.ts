/**
 * Buff/Debuff 图标排（HUD 左侧）
 */

import { UIBase } from '../core/UIBase';
import { Node, Label, Button, UITransform, Color } from 'cc';
import { UINode } from '../core/UINode';
import { instance as UI } from '../core/UIManager';
import { Palette, FontSize, DesignResolution } from '../core/UIConst';
import { Toast } from '../widget/Toast';
import type { BattleManager } from '../../battle/BattleManager';
import type { PlayerBuff } from '../../battle/BuffManager';

const ICON_SIZE = 36;

export interface BuffBarCtx {
    playerId: string;
    battle: BattleManager;
}

export class BuffBar extends UIBase {
    public playerId: string;
    public battle: BattleManager;

    constructor(ctx: BuffBarCtx) {
        super({});
        this.playerId = ctx.playerId;
        this.battle = ctx.battle;
        this._build();
        this._bind();
    }

    private _build(): void {
        const layer = UI.getLayer('hud');
        if (!layer) return;
        const bar = UINode.column({
            name: 'BuffBar',
            gap: 4,
            pos: { x: -DesignResolution.WIDTH / 2 + 80, y: DesignResolution.HEIGHT / 2 - 150 },
        });
        layer.addChild(bar.node);
        this.node = bar.node;
        this._refresh();
    }

    private _bind(): void {
        this.listen('buff_changed', () => this._refresh());
    }

    private _refresh(): void {
        if (!this.node) return;
        UINode.clearChildren(this.node);
        const buffs = this.battle.buffs.list(this.playerId);
        console.log('[BuffBar] refresh, count=', buffs.length, buffs.map(b => b.name || b.id));
        for (const b of buffs.slice(0, 10)) this._addIcon(b);
    }

    private _addIcon(buff: PlayerBuff): void {
        const isPerm = buff.duration === 'PERMANENT';
        const node = new Node('BuffIcon');
        const tr = node.addComponent(UITransform);
        tr.setContentSize(ICON_SIZE, ICON_SIZE);
        const lbl = node.addComponent(Label);
        lbl.string = buff.name ? buff.name.slice(0, 2) : '?';
        lbl.fontSize = 28;
        lbl.color = isPerm ? new Color(255, 215, 0, 255) : new Color(255, 255, 255, 255);
        lbl.horizontalAlign = Label.HorizontalAlign.CENTER;
        lbl.verticalAlign = Label.VerticalAlign.CENTER;
        const btn = node.addComponent(Button);
        btn.transition = Button.Transition.NONE;
        node.on(Node.EventType.TOUCH_END, () => {
            const name = buff.name || buff.id || '未知效果';
            const desc = buff.desc || '';
            const durMap: Record<string, string> = { PERMANENT: '永久', ONE_WAVE: '1波', THREE_WAVES: '3波', INSTANT: '即时' };
            const dur = durMap[buff.duration] || buff.duration;
            const text = desc ? `${name}\n${desc}\n持续: ${dur}` : `${name}\n持续: ${dur}`;
            Toast.close();
            Toast.show(text, { duration: 3000 });
        });
        this.node!.addChild(node);
    }
}
