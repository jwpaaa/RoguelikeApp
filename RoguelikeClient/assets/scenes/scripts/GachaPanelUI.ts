import { _decorator, Component, Label, Button } from 'cc';
import { instance as TimeManager } from '../../scripts/core/TimeManager';
import { instance as EventBus } from '../../scripts/core/EventBus';

const { ccclass, property } = _decorator;

const TIMEOUT_SEC = 10;

@ccclass('GachaPanelUI')
export class GachaPanelUI extends Component {

    @property(Label)  titleLabel: Label | null = null;
    @property(Label)  rarityLabel: Label | null = null;
    @property(Label)  cardName: Label | null = null;
    @property(Label)  cardIcon: Label | null = null;
    @property(Label)  cardDesc: Label | null = null;
    @property(Label)  countdownLabel: Label | null = null;
    @property(Button) btnConfirm: Button | null = null;

    private _data: any = null;
    private _hasInit = false;
    private _timeoutSec: number = TIMEOUT_SEC;

    update(_dt: number): void {
        if (this._data && !this._hasInit && this.cardName && this.btnConfirm && this.rarityLabel) {
            this._hasInit = true;
            this._fill();
        }
        if (this._data && this._hasInit) {
            this._timeoutSec -= _dt;
            if (this._timeoutSec <= 0) {
                this._timeoutSec = 0;
                this._confirm();
            }
            if (this.countdownLabel) {
                this.countdownLabel.string = Math.ceil(this._timeoutSec) + 's';
            }
        }
    }

    show(data: { playerId: string; card: any; refundedGold: number }): void {
        this._data = data;
        this._hasInit = false;
        this._timeoutSec = TIMEOUT_SEC;
    }

    onDestroy(): void {
    }

    private _fill(): void {
        if (!this._data) return;
        const card = this._data.card;

        if (this.rarityLabel) {
            this.rarityLabel.string = card.rarity || 'N';
        }
        const icons: Record<string, string> = { N: '⭐', R: '⭐✨', SR: '💎', SSR: '👑' };
        if (this.cardIcon) {
            this.cardIcon.string = icons[card.rarity] || '⭐';
        }
        if (this.cardName) {
            this.cardName.string = card.name || card.id || '???';
        }
        if (this.cardDesc) {
            this.cardDesc.string = card.desc || '';
        }
        if (this.btnConfirm) {
            this.btnConfirm.node.off(Button.EventType.CLICK);
            this.btnConfirm.node.on(Button.EventType.CLICK, () => this._confirm());
        }
    }

    private _confirm(): void {
        EventBus.emit('gacha_confirmed', this._data);
        this.node.destroy();
    }
}
