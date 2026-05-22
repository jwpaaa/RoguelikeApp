import { _decorator, Component, Node, Prefab, instantiate, resources } from 'cc';
import { instance as GameRoot } from '../../scripts/core/GameRoot';
import { instance as TimeManager } from '../../scripts/core/TimeManager';
import { instance as UIManager } from '../../scripts/ui/core/UIManager';
import { instance as EventBus } from '../../scripts/core/EventBus';
import { mountBattleHUD } from '../../scripts/ui/index';
import { MapRenderer } from './MapRenderer';
import { AutoTowerAI } from '../../scripts/battle/AutoTowerAI';
import { DicePanelUI } from './DicePanelUI';
import { GachaPanelUI } from './GachaPanelUI';
import { TowerPickPanelUI } from './TowerPickPanelUI';
import type { BattleManager } from '../../scripts/battle/BattleManager';

const { ccclass, property } = _decorator;

@ccclass('BattleScene')
export class BattleScene extends Component {

    @property(Node)
    mapLayer: Node | null = null;

    @property(Node)
    uiLayer: Node | null = null;

    @property(Prefab)
    dicePanelPrefab: Prefab | null = null;

    @property(Prefab)
    gachaPanelPrefab: Prefab | null = null;

    @property(Prefab)
    towerPickPanelPrefab: Prefab | null = null;

    private _battle: BattleManager | null = null;
    private _ai: AutoTowerAI | null = null;

    start(): void {
        UIManager.attachRoot(this.node);
        GameRoot.boot();

        this._battle = GameRoot.startBattle({
            seed: Date.now() | 0,
            difficulty: 2,
            players: [{ id: 'player1', name: '测试玩家' }],
        });

        mountBattleHUD({ battle: this._battle, playerId: 'player1', online: false });

        if (this.mapLayer) {
            const renderer = this.mapLayer.getComponent(MapRenderer);
            if (renderer) renderer.draw((this._battle as any).map);
        }

        this._ai = new AutoTowerAI({ playerId: 'player1', battle: this._battle });

        this._bindDice();
        this._bindGacha();
        this._bindShop();
        this._bindSettle();
    }

    update(_dt: number): void {
        TimeManager.update(_dt);
        if (this._ai) this._ai.tick(TimeManager.logicDtMs);
    }

    private _bindDice(): void {
        // 骰子面板由 _bindGacha 中的 wave_settle 控制弹出
        // 这里只处理三选一确认后的 apply
        EventBus.on('dice_pick_selected', (data: any) => {
            if (this._battle) {
                this._battle.diceSys.applyPick(data.playerId, data.selected);
            }
            EventBus.emit('wave_inter_event_done', { playerId: data.playerId });
        });
    }

    private _bindGacha(): void {
        EventBus.on('wave_settle', (settle: any) => {
            const gachas = settle.gachas || [];
            const dices = settle.dices || [];
            const towerPicks = settle.towerPicks || [];
            console.log('[BattleScene] wave_settle towerPicks=', towerPicks.length, 'gachas=', gachas.length, 'dices=', dices.length);

            // 事件队列：塔三选一 → 抽卡 → 骰子
            const runQueue = () => {
                if (towerPicks.length > 0) {
                    this._showTowerPickPanel(towerPicks[0], () => {
                        if (gachas.length > 0) {
                            this._showGachaPanel(gachas[0], () => {
                                if (dices.length > 0) this._showDicePanel(dices[0]);
                            });
                        } else if (dices.length > 0) {
                            this._showDicePanel(dices[0]);
                        }
                    });
                } else if (gachas.length > 0) {
                    this._showGachaPanel(gachas[0], () => {
                        if (dices.length > 0) this._showDicePanel(dices[0]);
                    });
                } else if (dices.length > 0) {
                    this._showDicePanel(dices[0]);
                }
            };
            runQueue();
        });
    }

    private _showTowerPickPanel(data: any, onDone: () => void): void {
        if (!this.towerPickPanelPrefab) {
            console.warn('[BattleScene] towerPickPanelPrefab 未绑定');
            onDone(); return;
        }
        console.log('[BattleScene] _showTowerPickPanel instantiate...');
        const node = instantiate(this.towerPickPanelPrefab);
        const ui = node.getComponent(TowerPickPanelUI);
        console.log('[BattleScene] TowerPickPanelUI component=', !!ui);
        if (ui) {
            UIManager.pushPopup(node);
            ui.show(data);
        } else {
            onDone(); return;
        }

        const handler = (result: any) => {
            EventBus.off('tower_pick_selected', handler);
            if (this._battle) {
                this._battle.pickSys.pick(result.playerId, result.selected);
            }
            onDone();
        };
        EventBus.on('tower_pick_selected', handler);
    }

    private _showGachaPanel(data: any, onDone: () => void): void {
        if (!this.gachaPanelPrefab) { onDone(); return; }
        const node = instantiate(this.gachaPanelPrefab);
        UIManager.pushPopup(node);
        const ui = node.getComponent(GachaPanelUI);
        if (ui) ui.show(data);

        // 等确认后回调
        const handler = () => {
            EventBus.off('gacha_confirmed', handler);
            onDone();
        };
        EventBus.on('gacha_confirmed', handler);
    }

    private _showDicePanel(data: any): void {
        if (!this.dicePanelPrefab) return;
        const node = instantiate(this.dicePanelPrefab);
        UIManager.pushPopup(node);
        const ui = node.getComponent(DicePanelUI);
        if (ui) ui.show(data);
    }

    private _bindShop(): void {
        EventBus.on('shop_open', (data: any) => {
            console.log('[Shop] 商店开启!', data);
        });
    }

    private _bindSettle(): void {
        EventBus.on('battle_end', (result: any) => {
            console.log('[Settle] 战斗结束!', result);
        });
    }
}
