import { _decorator, Component, Label, Button } from 'cc';
import { instance as TimeManager } from '../../scripts/core/TimeManager';
import { instance as EventBus } from '../../scripts/core/EventBus';
import type { BattleManager } from '../../scripts/battle/BattleManager';

const { ccclass, property } = _decorator;

const TIMEOUT_SEC = 60;

@ccclass('ShopPanelUI')
export class ShopPanelUI extends Component {

    @property(Label)  tierLabel: Label | null = null;
    @property(Label)  countdownLabel: Label | null = null;
    @property(Button) btnRefresh: Button | null = null;
    @property(Button) btnClose: Button | null = null;
    @property(Label)  refreshLabel: Label | null = null;

    private _battle: BattleManager | null = null;
    private _playerId: string = '';
    private _data: any = null;
    private _hasInit = false;
    private _timeoutSec: number = TIMEOUT_SEC;
    private _goodsList: Node | null = null;

    update(_dt: number): void {
        if (this._data && !this._hasInit) {
            this._goodsList = this.node.getChildByName('Panel')?.getChildByName('GoodsList');
            if (this._goodsList) {
                this._hasInit = true;
                this._fill();
            }
        }
        if (this._data && this._hasInit) {
            this._timeoutSec -= _dt;
            if (this._timeoutSec <= 0) this._close();
            if (this.countdownLabel) this.countdownLabel.string = Math.ceil(this._timeoutSec) + 's';
        }
    }

    show(ctx: { playerId: string; battle: BattleManager; perPlayer: any; tier: string }): void {
        this._battle = ctx.battle;
        this._playerId = ctx.playerId;
        this._data = ctx.perPlayer;
        this._data._tier = ctx.tier;
        this._hasInit = false;
        this._timeoutSec = TIMEOUT_SEC;
    }

    onDestroy(): void {
    }

    private _rebuild(): void {
        this._fill();
    }

    private _fill(): void {
        if (!this._data || !this._goodsList) return;
        const goods = this._data.goods || [];
        const sold: boolean[] = this._data.sold || [];
        const refreshLeft: number = this._data.refreshLeft || 0;

        // 获取当前金币
        const gold = this._battle?.economy.getGold(this._playerId) || 0;

        if (this.btnClose) {
            this.btnClose.node.off(Button.EventType.CLICK);
            this.btnClose.node.on(Button.EventType.CLICK, () => this._close());
        }
        if (this.tierLabel) {
            const m: Record<string, string> = { BASIC: '基础商店', ADVANCED: '进阶商店', PREMIUM: '高级商店', BOSS: 'BOSS前商店' };
            this.tierLabel.string = m[this._data._tier] || '商店';
        }
        if (this.refreshLabel) {
            this.refreshLabel.string = `刷新(30金币) 剩余${refreshLeft}次`;
        }
        if (this.btnRefresh) {
            const canRefresh = refreshLeft > 0 && gold >= 30;
            this.btnRefresh.interactable = canRefresh;
            this.btnRefresh.node.off(Button.EventType.CLICK);
            this.btnRefresh.node.on(Button.EventType.CLICK, () => {
                const r = this._battle?.shopCtl.refresh(this._playerId);
                if (r?.ok && this._battle) {
                    const snap = (this._battle.shopCtl as any)._snapshot?.() || {};
                    this._data = { ...snap[this._playerId], _tier: this._data._tier };
                    this._rebuild();
                }
            });
        }

        const cards = this._goodsList.children;
        for (let i = 0; i < 5; i++) {
            const card = cards[i];
            if (!card) continue;
            if (i < goods.length) {
                card.active = true;
                const g = goods[i];
                const isSold = sold[i];
                this._setCardLabel(card, 0, g.icon || '?');
                this._setCardLabel(card, 1, g.name);
                this._setCardLabel(card, 2, g.desc);
                this._setCardLabel(card, 3, isSold ? '已售罄' : `💰${g.price}`);

                const btnBuy = card.getChildByName('BtnBuy')?.getComponent(Button);
                if (btnBuy) {
                    const canBuy = !isSold && gold >= (g.price || 9999);
                    btnBuy.interactable = canBuy;
                    btnBuy.node.off(Button.EventType.CLICK);
                    const idx = i;
                    btnBuy.node.on(Button.EventType.CLICK, () => {
                        const r = this._battle?.shopCtl.buy(this._playerId, idx);
                        if (r?.ok && this._battle) {
                            const snap = (this._battle.shopCtl as any)._snapshot?.() || {};
                            this._data = { ...snap[this._playerId], _tier: this._data._tier };
                            this._rebuild();
                        }
                    });
                    const btnLbl = btnBuy.node.getComponentInChildren(Label);
                    if (btnLbl) btnLbl.string = isSold ? '已售' : '购买';
                }
            } else {
                card.active = false;
            }
        }
    }

    private _setCardLabel(card: Node, idx: number, text: string): void {
        const kids = card.children;
        if (idx < kids.length) {
            const lbl = kids[idx].getComponent(Label);
            if (lbl) lbl.string = text;
        }
    }

    private _close(): void {
        EventBus.emit('shop_closed', { playerId: this._playerId });
        this.node.destroy();
    }
}
