import { _decorator, Component, Label, Button } from 'cc';
import { instance as EventBus } from '../../scripts/core/EventBus';

const { ccclass, property } = _decorator;

const TOWER_ICONS: Record<string, string> = {
    ARROW: '🏹', CANNON: '💣', ICE: '❄️', MAGIC: '🔮',
    TESLA: '⚡', POISON: '☠️', SUMMON: '🧙', TOTEM: '🗿',
};

@ccclass('TowerOpPanelUI')
export class TowerOpPanelUI extends Component {

    @property(Label)  towerIcon: Label | null = null;
    @property(Label)  towerName: Label | null = null;
    @property(Label)  statAtk: Label | null = null;
    @property(Label)  statSpeed: Label | null = null;
    @property(Label)  statRange: Label | null = null;
    @property(Button) btnUpgrade: Button | null = null;
    @property(Button) btnSell: Button | null = null;
    @property(Button) btnClose: Button | null = null;

    private _data: any = null;
    private _hasInit = false;
    private _battle: any = null;

    update(_dt: number): void {
        if (this._data && !this._hasInit && this.towerName && this.btnClose) {
            this._hasInit = true;
            this._fill();
        }
    }

    show(ctx: { tower: any; playerId: string; battle: any }): void {
        this._data = ctx;
        this._battle = ctx.battle;
        this._hasInit = false;
    }

    private _fill(): void {
        if (!this._data) return;
        const t = this._data.tower;
        const cfg = (t.constructor as any).config?.[t.type] || {};
        const stat = t.getLevelStat?.() || {};

        if (this.towerIcon) this.towerIcon.string = TOWER_ICONS[t.type] || '?';
        if (this.towerName) this.towerName.string = `${cfg.name || t.type} Lv.${t.level}`;
        if (this.statAtk)   this.statAtk.string = `攻击: ${stat.atk || (stat.auraAtk ? Math.round(stat.auraAtk*100)+'%' : '-')}`;
        if (this.statSpeed) this.statSpeed.string = `攻速: ${stat.atkSpeed ? stat.atkSpeed+'s' : '-'}`;
        if (this.statRange) this.statRange.string = `射程: ${stat.range || stat.auraRange || '-'}格`;

        if (this.btnClose) {
            this.btnClose.node.off(Button.EventType.CLICK);
            this.btnClose.node.on(Button.EventType.CLICK, () => this.node.destroy());
        }

        const maxLevel = 3;
        const canUpgrade = t.level < maxLevel;
        const upgradeCost = this._battle?.economy ? 100 : 9999; // 简化，实际应该从配置取
        const playerGold = this._battle?.economy?.getGold?.(this._data.playerId) || 0;

        if (this.btnUpgrade) {
            this.btnUpgrade.node.off(Button.EventType.CLICK);
            const btnLabel = this.btnUpgrade.getComponentInChildren(Label);
            if (!canUpgrade) {
                if (btnLabel) btnLabel.string = '已满级';
                this.btnUpgrade.interactable = false;
            } else if (playerGold < upgradeCost) {
                if (btnLabel) btnLabel.string = `升级 💰${upgradeCost}`;
                this.btnUpgrade.interactable = false;
            } else {
                if (btnLabel) btnLabel.string = `升级 💰${upgradeCost}`;
                this.btnUpgrade.interactable = true;
                this.btnUpgrade.node.on(Button.EventType.CLICK, () => {
                    this._battle?.upgrade?.(this._data.playerId, t.id);
                    this.node.destroy();
                });
            }
        }

        if (this.btnSell) {
            this.btnSell.node.off(Button.EventType.CLICK);
            const sellPrice = Math.floor((this._battle?.getSellPrice?.(t.id) || 50));
            this.btnSell.getComponentInChildren(Label)!.string = `出售 💰${sellPrice}`;
            this.btnSell.node.on(Button.EventType.CLICK, () => {
                this._battle?.sell?.(this._data.playerId, t.id);
                this.node.destroy();
            });
        }
    }
}
