import { _decorator, Component, Label, Button } from 'cc';
import { TOTAL_WAVES } from '../../scripts/config/WaveConfig';

const { ccclass, property } = _decorator;

@ccclass('SettlementPanelUI')
export class SettlementPanelUI extends Component {

    @property(Label)  resultTitle: Label | null = null;
    @property(Label)  gradeLabel: Label | null = null;
    @property(Label)  statWave: Label | null = null;
    @property(Label)  statKills: Label | null = null;
    @property(Label)  statGold: Label | null = null;
    @property(Label)  statLeaks: Label | null = null;
    @property(Label)  statScore: Label | null = null;
    @property(Button) btnConfirm: Button | null = null;

    private _data: any = null;
    private _hasInit = false;

    update(_dt: number): void {
        if (this._data && !this._hasInit && this.resultTitle && this.btnConfirm) {
            this._hasInit = true;
            this._fill();
        }
    }

    show(data: { win: boolean; wave: number; kills: number; leaks: number; totalGold: number; score: { score: number; grade: string } }): void {
        this._data = data;
        this._hasInit = false;
    }

    private _fill(): void {
        if (!this._data) return;
        const d = this._data;

        if (this.resultTitle) this.resultTitle.string = d.win ? '🎉 胜利!' : '💀 失败...';
        if (this.gradeLabel)  this.gradeLabel.string = d.score?.grade || 'D';
        if (this.statWave)    this.statWave.string = `波次: ${d.wave}/${TOTAL_WAVES}`;
        if (this.statKills)   this.statKills.string = `击杀: ${d.kills}`;
        if (this.statGold)    this.statGold.string = `金币: ${d.totalGold}`;
        if (this.statLeaks)   this.statLeaks.string = `漏怪: ${d.leaks}`;
        if (this.statScore)   this.statScore.string = `评分: ${d.score?.score} 分`;
        if (this.btnConfirm) {
            this.btnConfirm.node.off(Button.EventType.CLICK);
            this.btnConfirm.node.on(Button.EventType.CLICK, () => this.node.destroy());
        }
    }
}
