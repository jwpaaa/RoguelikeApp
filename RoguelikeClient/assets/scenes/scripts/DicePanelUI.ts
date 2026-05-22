import { _decorator, Component, Node, Label, Button, Sprite, Color } from 'cc';
import { instance as EventBus } from '../../scripts/core/EventBus';
import { instance as TimeManager } from '../../scripts/core/TimeManager';

const { ccclass, property } = _decorator;

const ICONS: Record<string, string> = {
    M: '👹', T: '🗼', E: '💰', P: '✨',
};

const TIMEOUT_SEC = 10;

@ccclass('DicePanelUI')
export class DicePanelUI extends Component {

    @property(Label)  diceLabel: Label | null = null;
    @property(Node)   effectList: Node | null = null;
    @property(Button) btnConfirm: Button | null = null;
    @property(Label)  countdownLabel: Label | null = null;

    private _data: any = null;
    private _selectedIdx: number = -1;
    private _hasInit = false;
    private _timeoutSec: number = TIMEOUT_SEC;

    update(_dt: number): void {
        if (this._data && !this._hasInit && this.effectList && this.btnConfirm) {
            this._hasInit = true;
            this._fillData();
        }
        // 倒计时
        if (this._data && this._hasInit) {
            this._timeoutSec -= _dt;
            if (this._timeoutSec <= 0) {
                this._timeoutSec = 0;
                this._autoConfirm();
            }
            if (this.countdownLabel) {
                this.countdownLabel.string = Math.ceil(this._timeoutSec) + 's';
            }
        }
    }

    show(data: { playerId: string; dice: number; picks: Array<{ name: string; desc: string; id: string }> }): void {
        this._data = data;
        this._selectedIdx = -1;
        this._hasInit = false;
        this._timeoutSec = TIMEOUT_SEC;

        // 暂停战斗
        TimeManager.pause();
    }

    onDestroy(): void {
        // 恢复战斗
        TimeManager.resume();
        // 如果没选，默认选第一个
        if (this._selectedIdx < 0 && this._data) {
            this._confirm(0);
        }
    }

    private _autoConfirm(): void {
        if (this._selectedIdx < 0 && this._data) {
            this._confirm(0);
        }
        this.node.destroy();
    }

    private _fillData(): void {
        if (!this._data) return;
        const data = this._data;

        if (this.diceLabel) {
            this.diceLabel.string = String(data.dice);
        }

        if (this.btnConfirm) {
            this.btnConfirm.interactable = false;
            this.btnConfirm.node.off(Button.EventType.CLICK);
            this.btnConfirm.node.on(Button.EventType.CLICK, () => {
                if (this._selectedIdx < 0) return;
                this._confirm(this._selectedIdx);
                this.node.destroy();
            });
        }

        if (this.effectList) {
            const cards = this.effectList.children;
            for (let i = 0; i < 3; i++) {
                const card = cards[i];
                if (!card) continue;

                if (i < data.picks.length) {
                    card.active = true;
                    const pick = data.picks[i];

                    const kids = card.children;
                    for (const kid of kids) {
                        const lbl = kid.getComponent(Label);
                        if (!lbl) continue;
                        if (kid.name.includes('Icon') || kid === kids[0]) {
                            lbl.string = ICONS[pick.id.charAt(0)] || '❓';
                        } else if (kid.name.includes('Name') || kid === kids[1]) {
                            lbl.string = pick.name;
                        } else if (kid.name.includes('Desc') || kid === kids[2]) {
                            lbl.string = pick.desc;
                        }
                    }

                    const sp = card.getComponent(Sprite);
                    if (sp) sp.color = new Color(55, 55, 75, 255);

                    let btn = card.getComponent(Button);
                    if (!btn) btn = card.addComponent(Button);
                    btn.transition = Button.Transition.NONE;
                    btn.node.off(Button.EventType.CLICK);
                    const idx = i;
                    btn.node.on(Button.EventType.CLICK, () => this._selectCard(idx));
                } else {
                    card.active = false;
                }
            }
        }
    }

    private _selectCard(idx: number): void {
        this._selectedIdx = idx;
        if (this.effectList) {
            const cards = this.effectList.children;
            for (let i = 0; i < 3; i++) {
                const card = cards[i];
                if (!card) continue;
                const sp = card.getComponent(Sprite);
                if (sp) {
                    sp.color = i === idx
                        ? new Color(65, 180, 255, 255)
                        : new Color(55, 55, 75, 255);
                }
            }
        }
        if (this.btnConfirm) this.btnConfirm.interactable = true;
    }

    private _confirm(idx: number): void {
        const pick = this._data.picks[idx];
        EventBus.emit('dice_pick_selected', {
            playerId: this._data.playerId,
            selected: pick,
        });
    }
}
