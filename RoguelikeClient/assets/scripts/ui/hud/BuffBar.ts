/**
 * Buff/Debuff 图标排（HUD 左侧）
 */

import { UIBase } from '../core/UIBase';
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
            pos: { x: -DesignResolution.WIDTH / 2 + 30, y: DesignResolution.HEIGHT / 2 - 80 },
        });
        layer.addChild(bar.node);
        this.node = bar.node;
        this._refresh();
    }

    private _bind(): void {
        this.listen('dice_rolled', () => this._refresh());
        this.listen('gacha_drawn', () => this._refresh());
        this.listen('wave_settle', () => this._refresh());
    }

    private _refresh(): void {
        if (!this.node) return;
        UINode.clearChildren(this.node);
        const buffs = this.battle.buffs.list(this.playerId);
        for (const b of buffs.slice(0, 10)) this._addIcon(b);
    }

    private _addIcon(buff: PlayerBuff): void {
        const isPerm = buff.duration === 'PERMANENT';
        const node = UINode.panel({
            name: 'BuffIcon',
            size: { w: ICON_SIZE, h: ICON_SIZE },
            color: isPerm ? Palette.GOLD : Palette.WHITE,
        });
        const { node: lblNode } = UINode.label({
            text: buff.name ? buff.name.slice(0, 1) : '?',
            fontSize: FontSize.SMALL,
            color: Palette.BLACK,
        });
        node.addChild(lblNode);
        node.on('click', () => Toast.info(buff.name || buff.id));
        this.node!.addChild(node);
    }
}
