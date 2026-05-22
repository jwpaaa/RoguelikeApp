import { _decorator, Component, Label, Button, Sprite, Color } from 'cc';
import { instance as TimeManager } from '../../scripts/core/TimeManager';
import { instance as EventBus } from '../../scripts/core/EventBus';
import { TowerConfig, type TowerTypeValue } from '@rtd/shared';

const { ccclass, property } = _decorator;

const TIMEOUT_SEC = 10;

const TOWER_ICONS: Record<string, string> = {
    ARROW: '🏹', CANNON: '💣', ICE: '❄️', MAGIC: '🔮',
    TESLA: '⚡', POISON: '☠️', SUMMON: '🧙', TOTEM: '🗿',
};

@ccclass('TowerPickPanelUI')
export class TowerPickPanelUI extends Component {

    @property(Label)  countdownLabel: Label | null = null;
    @property(Button) btnConfirm: Button | null = null;

    private _data: any = null;
    private _hasInit = false;
    private _selectedIdx: number = -1;
    private _timeoutSec: number = TIMEOUT_SEC;
    private _cardList: Node | null = null;

    update(_dt: number): void {
        if (this._data && !this._hasInit && this.btnConfirm) {
            this._cardList = this.node.getChildByName('Panel')?.getChildByName('CardList');
            if (this._cardList) {
                this._hasInit = true;
                this._fill();
            }
        }
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

    show(data: { playerId: string; options: TowerTypeValue[] }): void {
        this._data = data;
        this._hasInit = false;
        this._selectedIdx = -1;
        this._timeoutSec = TIMEOUT_SEC;
        TimeManager.pause();
    }

    onDestroy(): void {
        TimeManager.resume();
        if (this._selectedIdx < 0 && this._data) {
            this._confirm(0);
        }
    }

    private _fill(): void {
        if (!this._data || !this._cardList) return;
        const options: TowerTypeValue[] = this._data.options;

        if (this.btnConfirm) {
            this.btnConfirm.interactable = false;
            this.btnConfirm.node.off(Button.EventType.CLICK);
            this.btnConfirm.node.on(Button.EventType.CLICK, () => {
                if (this._selectedIdx < 0) return;
                this._confirm(this._selectedIdx);
                this.node.destroy();
            });
        }

        const cards = this._cardList.children;
        for (let i = 0; i < 3; i++) {
            const card = cards[i];
            if (!card) continue;

            if (i < options.length) {
                card.active = true;
                const type = options[i];
                const cfg = TowerConfig[type] as any;
                const kids = card.children;
                for (const kid of kids) {
                    const lbl = kid.getComponent(Label);
                    if (!lbl) continue;
                    if (kid.name.includes('Icon') || kid === kids[0]) {
                        lbl.string = TOWER_ICONS[type] || '?';
                    } else if (kid.name.includes('Name') || kid === kids[1]) {
                        lbl.string = (cfg && cfg.name) || type;
                    } else if (kid.name.includes('Desc') || kid === kids[2]) {
                        lbl.string = this._getDesc(type);
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

    private _getDesc(type: TowerTypeValue): string {
        const cfg = TowerConfig[type] as any;
        const lv1 = cfg?.levels?.[0] || {};
        const parts: string[] = [];
        if (lv1.atk) parts.push(`攻${lv1.atk}`);
        if (lv1.atkSpeed) parts.push(`CD${lv1.atkSpeed}s`);
        if (lv1.range) parts.push(`射程${lv1.range}`);
        if (lv1.slow) parts.push(`减速${Math.round(lv1.slow * 100)}%`);
        if (lv1.pierce) parts.push(`穿透${lv1.pierce}`);
        if (lv1.dot) parts.push(`毒${lv1.dot}/s`);
        if (lv1.chain) parts.push(`连锁${lv1.chain}`);
        if (lv1.auraAtk && lv1.auraSpd) parts.push(`光环`);
        if (lv1.minionHp) parts.push(`召唤${lv1.minionMax}只`);
        if (!lv1.atk && lv1.auraAtk) parts[0] = `光环${lv1.auraAtk * 100}%`;
        return parts.slice(0, 3).join(' ');
    }

    private _selectCard(idx: number): void {
        this._selectedIdx = idx;
        if (this._cardList) {
            const cards = this._cardList.children;
            for (let i = 0; i < 3; i++) {
                const sp = cards[i]?.getComponent(Sprite);
                if (sp) {
                    sp.color = i === idx
                        ? new Color(65, 180, 255, 255)
                        : new Color(55, 55, 75, 255);
                }
            }
        }
        if (this.btnConfirm) this.btnConfirm.interactable = true;
    }

    private _autoConfirm(): void {
        if (this._selectedIdx < 0 && this._data) this._confirm(0);
        this.node.destroy();
    }

    private _confirm(idx: number): void {
        const type = this._data.options[idx];
        EventBus.emit('tower_pick_selected', {
            playerId: this._data.playerId,
            selected: type,
        });
    }
}
