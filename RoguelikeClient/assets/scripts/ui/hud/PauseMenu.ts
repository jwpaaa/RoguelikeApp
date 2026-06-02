/**
 * 暂停浮窗（含投票显示）
 */

import { UIBase } from '../core/UIBase';
import { UINode } from '../core/UINode';
import { instance as UI } from '../core/UIManager';
import { Palette, FontSize, DesignResolution } from '../core/UIConst';
import { Dialog } from '../widget/Dialog';
import { instance as EventBus } from '../../core/EventBus';
import type { BattleManager } from '../../battle/BattleManager';
import type { PauseSource } from '../../battle/PauseController';

export interface PauseMenuCtx {
    playerId: string;
    battle: BattleManager;
}

export class PauseMenu extends UIBase {
    public playerId: string;
    public battle: BattleManager;

    constructor(ctx: PauseMenuCtx) {
        super({});
        this.playerId = ctx.playerId;
        this.battle = ctx.battle;
        this._bind();
    }

    private _bind(): void {
        this.listen('pause_enter',         (e: any) => this._show(e));
        this.listen('pause_resume',        () => this._hide());
        this.listen('pause_vote_started',  (e: any) => this._showVote(e));
        this.listen('pause_vote_failed',   () => this._hide());
    }

    private _show(e: { source: PauseSource; remainMs: number }): void {
        this._hide();
        const layer = UI.getLayer('popup');
        if (!layer) return;
        const mask = UINode.panel({
            name: 'PauseMask',
            size: { w: DesignResolution.WIDTH, h: DesignResolution.HEIGHT },
            color: 0x00000066,
        });
        layer.addChild(mask);
        UI.popupStack.push(mask);

        const panel = UINode.panel({
            name: 'PausePanel',
            size: { w: 480, h: 300 },
            color: Palette.PANEL_BG,
        });
        mask.addChild(panel);

        const { node: title } = UINode.label({
            text: '⏸ 游戏已暂停',
            fontSize: FontSize.LARGE,
            color: Palette.GOLD,
            pos: { x: 0, y: 100 },
        });
        panel.addChild(title);

        const { node: info } = UINode.label({
            text: this._infoText(e),
            fontSize: FontSize.NORMAL,
            color: Palette.WHITE,
            pos: { x: 0, y: 30 },
            size: { w: 460, h: 60 },
        });
        panel.addChild(info);

        const resume = UINode.button({
            text: '继续',
            size: { w: 160, h: 50 },
            pos: { x: -100, y: -80 },
            onClick: () => this.battle.resume(),
        });
        panel.addChild(resume.node);

        const quit = UINode.button({
            text: '退出对局',
            size: { w: 160, h: 50 },
            pos: { x: 100, y: -80 },
            color: Palette.RED,
            onClick: async () => {
                const ok = await Dialog.confirm('确定退出对局吗？');
                if (ok) EventBus.emit('battle_quit_request');
            },
        });
        panel.addChild(quit.node);

        this.node = mask;
    }

    private _showVote(e: { initiator: string }): void {
        this._hide();
        const layer = UI.getLayer('popup');
        if (!layer) return;
        const mask = UINode.panel({
            name: 'VoteMask',
            size: { w: DesignResolution.WIDTH, h: DesignResolution.HEIGHT },
            color: 0x00000066,
        });
        layer.addChild(mask);
        UI.popupStack.push(mask);

        const panel = UINode.panel({
            name: 'VotePanel',
            size: { w: 480, h: 240 },
            color: Palette.PANEL_BG,
        });
        mask.addChild(panel);

        const { node: title } = UINode.label({
            text: `🗳 ${e.initiator} 发起了暂停投票`,
            fontSize: FontSize.LARGE,
            color: Palette.WHITE,
            pos: { x: 0, y: 70 },
        });
        panel.addChild(title);

        const yes = UINode.button({
            text: '同意',
            size: { w: 140, h: 50 },
            pos: { x: -80, y: -60 },
            color: Palette.GREEN,
            onClick: () => { this.battle.pauseVote(this.playerId, true); this._hide(); },
        });
        panel.addChild(yes.node);

        const no = UINode.button({
            text: '拒绝',
            size: { w: 140, h: 50 },
            pos: { x: 80, y: -60 },
            color: Palette.RED,
            onClick: () => { this.battle.pauseVote(this.playerId, false); this._hide(); },
        });
        panel.addChild(no.node);

        this.node = mask;
    }

    private _infoText(e: { source: PauseSource; remainMs: number }): string {
        const remainSec = Math.ceil((e.remainMs || 0) / 1000);
        const sourceMap: Record<PauseSource, string> = {
            host: '房主',
            vote: '队员投票通过',
            disconnect: '队友断线',
            network: '网络异常',
        };
        return `${sourceMap[e.source] || e.source} 触发\n最长 ${remainSec} 秒后自动继续`;
    }

    private _hide(): void {
        if (this.node) {
            const idx = UI.popupStack.indexOf(this.node);
            if (idx >= 0) UI.popupStack.splice(idx, 1);
            this.node.destroy();
            this.node = null;
        }
    }
}
