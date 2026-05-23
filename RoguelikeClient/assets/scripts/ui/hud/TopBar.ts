/**
 * 顶部信息栏（波次 / 金币 / 水晶生命 / 暂停按钮）
 */

import { UIBase } from '../core/UIBase';
import { UINode } from '../core/UINode';
import { instance as UI } from '../core/UIManager';
import { Palette, FontSize, DesignResolution } from '../core/UIConst';
import { TOTAL_WAVES } from '../../config/WaveConfig';
import type { BattleManager } from '../../battle/BattleManager';
import type { cc } from '../core/CocosAdapter';

export interface TopBarCtx {
    playerId: string;
    battle: BattleManager;
}

export class TopBar extends UIBase {
    public playerId: string;
    public battle: BattleManager;
    public waveLbl: cc.Label | null = null;
    public goldLbl: cc.Label | null = null;
    public lifeLbl: cc.Label | null = null;

    constructor(ctx: TopBarCtx) {
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
            name: 'TopBar',
            size: { w: DesignResolution.WIDTH, h: 60 },
            pos: { x: 0, y: DesignResolution.HEIGHT / 2 - 30 },
            color: Palette.PANEL_BG,
        });
        layer.addChild(bar);
        this.node = bar;

        const waveLbl = UINode.label({
            text: '波次: 0/20',
            fontSize: FontSize.LARGE,
            color: Palette.WHITE,
            pos: { x: -DesignResolution.WIDTH / 2 + 100, y: 0 },
        });
        bar.addChild(waveLbl.node);
        this.waveLbl = waveLbl.label;

        const goldLbl = UINode.label({
            text: '💰 0',
            fontSize: FontSize.LARGE,
            color: Palette.GOLD,
            pos: { x: 0, y: 0 },
        });
        bar.addChild(goldLbl.node);
        this.goldLbl = goldLbl.label;

        const lifeLbl = UINode.label({
            text: '❤️ 5/5',
            fontSize: FontSize.LARGE,
            color: Palette.RED,
            pos: { x: DesignResolution.WIDTH / 2 - 200, y: 0 },
        });
        bar.addChild(lifeLbl.node);
        this.lifeLbl = lifeLbl.label;

        const pauseBtn = UINode.button({
            text: '⏸',
            size: { w: 60, h: 50 },
            pos: { x: DesignResolution.WIDTH / 2 - 50, y: 0 },
            onClick: () => this.battle.pause(this.playerId),
        });
        bar.addChild(pauseBtn.node);

        this._refresh();
    }

    private _bind(): void {
        this.listen('economy_change', (payload: any) => {
            if (payload && payload.playerId === this.playerId) this._refreshGold();
        });
        this.listen('crystal_damaged', () => this._refreshLife());
        this.listen('wave_start', () => this._refreshWave());
        this.listen('wave_end',   () => this._refreshWave());
    }

    private _refresh(): void {
        this._refreshWave();
        this._refreshGold();
        this._refreshLife();
    }

    private _refreshWave(): void {
        if (!this.waveLbl) return;
        this.waveLbl.string = `波次: ${this.battle.currentWave}/${TOTAL_WAVES}`;
    }
    private _refreshGold(): void {
        if (!this.goldLbl) return;
        this.goldLbl.string = '💰 ' + this.battle.economy.getGold(this.playerId);
    }
    private _refreshLife(): void {
        if (!this.lifeLbl) return;
        const c = this.battle.crystal;
        const shieldStr = c.shield > 0 ? ` (+${c.shield}🛡)` : '';
        this.lifeLbl.string = `❤️ ${c.hp}/${c.maxHp}${shieldStr}`;
    }
}
