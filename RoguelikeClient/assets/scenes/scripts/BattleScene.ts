import { _decorator, Component, Node, Prefab, instantiate } from 'cc';
import { instance as GameRoot } from '../../scripts/core/GameRoot';
import { instance as TimeManager } from '../../scripts/core/TimeManager';
import { instance as UIManager } from '../../scripts/ui/core/UIManager';
import { instance as EventBus } from '../../scripts/core/EventBus';
import { TOTAL_WAVES } from '../../scripts/config/WaveConfig';
import { mountBattleHUD } from '../../scripts/ui/index';
import { MapRenderer } from './MapRenderer';
import { AutoTowerAI } from '../../scripts/battle/AutoTowerAI';
import { DicePanelUI } from './DicePanelUI';
import { GachaPanelUI } from './GachaPanelUI';
import { TowerPickPanelUI } from './TowerPickPanelUI';
import { ShopPanelUI } from './ShopPanelUI';
import { SettlementPanelUI } from './SettlementPanelUI';
import type { BattleManager } from '../../scripts/battle/BattleManager';

const { ccclass, property } = _decorator;

@ccclass('BattleScene')
export class BattleScene extends Component {

    @property(Node)   mapLayer: Node | null = null;
    @property(Node)   uiLayer: Node | null = null;
    @property(Prefab) dicePanelPrefab: Prefab | null = null;
    @property(Prefab) gachaPanelPrefab: Prefab | null = null;
    @property(Prefab) towerPickPanelPrefab: Prefab | null = null;
    @property(Prefab) shopPanelPrefab: Prefab | null = null;
    @property(Prefab) settlementPanelPrefab: Prefab | null = null;

    private _battle: BattleManager | null = null;
    private _ai: AutoTowerAI | null = null;
    private _lastShopData: any = {};
    private _lastShopTier: string = '';

    start(): void {
        UIManager.attachRoot(this.node);
        GameRoot.boot();
        this._battle = GameRoot.startBattle({ seed: Date.now() | 0, difficulty: 2, players: [{ id: 'player1', name: '测试玩家' }] });
        mountBattleHUD({ battle: this._battle, playerId: 'player1', online: false });
        if (this.mapLayer) { const r = this.mapLayer.getComponent(MapRenderer); if (r) r.draw((this._battle as any).map); }
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
        EventBus.on('dice_pick_selected', (data: any) => {
            if (this._battle) this._battle.diceSys.applyPick(data.playerId, data.selected);
            EventBus.emit('wave_inter_event_done', { playerId: data.playerId });
        });
    }

    private _bindGacha(): void {
        EventBus.on('wave_settle', (settle: any) => {
            const gachas = settle.gachas || [];
            const dices = settle.dices || [];
            const towerPicks = settle.towerPicks || [];

            const finalDone = () => {
                TimeManager.resume();
                EventBus.emit('wave_inter_event_done', { playerId: 'player1' });
            };

            // 最后一波直接结束，不弹任何面板
            if (settle.wave >= TOTAL_WAVES) {
                finalDone();
                return;
            }

            const runQueue = () => {
                TimeManager.pause();
                const next = () => {
                    if (settle.shop) { this._showShopPanel(finalDone); }
                    else { finalDone(); }
                };
                if (towerPicks.length > 0) {
                    this._showTowerPickPanel(towerPicks[0], () => {
                        if (gachas.length > 0) { this._showGachaPanel(gachas[0], () => {
                            if (dices.length > 0) this._showDicePanel(dices[0], next); else next();
                        }); } else if (dices.length > 0) { this._showDicePanel(dices[0], next); } else next();
                    });
                } else if (gachas.length > 0) {
                    this._showGachaPanel(gachas[0], () => {
                        if (dices.length > 0) this._showDicePanel(dices[0], next); else next();
                    });
                } else if (dices.length > 0) { this._showDicePanel(dices[0], next); }
                else next();
            };
            runQueue();
        });
    }

    private _showTowerPickPanel(data: any, onDone: () => void): void {
        if (!this.towerPickPanelPrefab) { onDone(); return; }
        const node = instantiate(this.towerPickPanelPrefab);
        UIManager.pushPopup(node);
        const ui = node.getComponent(TowerPickPanelUI);
        if (!ui) { onDone(); return; }
        ui.show(data);
        const handler = (r: any) => { EventBus.off('tower_pick_selected', handler); if (this._battle) this._battle.pickSys.pick(r.playerId, r.selected); onDone(); };
        EventBus.on('tower_pick_selected', handler);
    }

    private _showGachaPanel(data: any, onDone: () => void): void {
        if (!this.gachaPanelPrefab) { onDone(); return; }
        const node = instantiate(this.gachaPanelPrefab);
        UIManager.pushPopup(node);
        const ui = node.getComponent(GachaPanelUI);
        if (ui) ui.show(data);
        const handler = () => { EventBus.off('gacha_confirmed', handler); onDone(); };
        EventBus.on('gacha_confirmed', handler);
    }

    private _showDicePanel(data: any, onDone?: () => void): void {
        if (!this.dicePanelPrefab) { onDone?.(); return; }
        const node = instantiate(this.dicePanelPrefab);
        UIManager.pushPopup(node);
        const ui = node.getComponent(DicePanelUI);
        if (ui) ui.show(data);
        const handler = () => { EventBus.off('dice_pick_selected', handler); if (onDone) onDone(); };
        EventBus.on('dice_pick_selected', handler);
    }

    private _showShopPanel(onDone: () => void): void {
        if (!this.shopPanelPrefab) { onDone(); return; }
        const node = instantiate(this.shopPanelPrefab);
        UIManager.pushPopup(node);
        const ui = node.getComponent(ShopPanelUI);
        if (ui) ui.show({ playerId: 'player1', battle: this._battle!, perPlayer: this._lastShopData, tier: this._lastShopTier });
        const handler = () => { EventBus.off('shop_closed', handler); onDone(); };
        EventBus.on('shop_closed', handler);
    }

    private _bindShop(): void {
        EventBus.on('shop_open', (data: any) => {
            this._lastShopData = data.perPlayer?.player1 || {};
            this._lastShopTier = data.tier || '';
        });
    }

    private _bindSettle(): void {
        EventBus.on('battle_end', (result: any) => {
            console.log('[BattleScene] battle_end!', result);
            TimeManager.pause();
            if (!this.settlementPanelPrefab) {
                console.warn('[BattleScene] settlementPanelPrefab 未绑定');
                return;
            }
            const node = instantiate(this.settlementPanelPrefab);
            UIManager.pushPopup(node);
            const ui = node.getComponent(SettlementPanelUI);
            console.log('[BattleScene] SettlementPanelUI=', !!ui);
            if (ui) ui.show(result);
        });
    }
}
