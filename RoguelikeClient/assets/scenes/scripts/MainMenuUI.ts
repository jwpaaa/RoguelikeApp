import { _decorator, Component, Button, director, Prefab, instantiate } from 'cc';
import { instance as UIManager } from '../../scripts/ui/core/UIManager';
import { SettingsPanelUI } from './SettingsPanelUI';

const { ccclass, property } = _decorator;

@ccclass('MainMenuUI')
export class MainMenuUI extends Component {

    @property(Button) btnSingle: Button | null = null;
    @property(Button) btnMulti: Button | null = null;
    @property(Button) btnTalent: Button | null = null;
    @property(Button) btnLeaderboard: Button | null = null;
    @property(Button) btnCollection: Button | null = null;
    @property(Button) btnSettings: Button | null = null;

    @property(Prefab) settingsPrefab: Prefab | null = null;

    start(): void {
        UIManager.attachRoot(this.node.parent || this.node);
        if (this.btnSingle) {
            this.btnSingle.node.on(Button.EventType.CLICK, () => {
                director.loadScene('Battle');
            });
        }
        if (this.btnMulti) {
            this.btnMulti.node.on(Button.EventType.CLICK, () => {
                director.loadScene('Room');
            });
        }
        if (this.btnTalent) {
            this.btnTalent.node.on(Button.EventType.CLICK, () => {
                director.loadScene('TalentTree');
            });
        }
        if (this.btnLeaderboard) {
            this.btnLeaderboard.node.on(Button.EventType.CLICK, () => {
                director.loadScene('Leaderboard');
            });
        }
        if (this.btnCollection) {
            this.btnCollection.node.on(Button.EventType.CLICK, () => {
                director.loadScene('Collection');
            });
        }
        if (this.btnSettings) {
            this.btnSettings.node.on(Button.EventType.CLICK, () => {
                if (!this.settingsPrefab) return;
                const node = instantiate(this.settingsPrefab);
                UIManager.pushPopup(node);
            });
        }
    }
}
