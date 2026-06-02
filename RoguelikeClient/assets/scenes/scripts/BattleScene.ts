import { _decorator, Component, Node, Prefab, instantiate, director } from 'cc';
import { instance as GameRoot } from '../../scripts/core/GameRoot';
import { instance as TimeManager } from '../../scripts/core/TimeManager';
import { instance as UIManager } from '../../scripts/ui/core/UIManager';
import { instance as EventBus } from '../../scripts/core/EventBus';
import { TOTAL_WAVES } from '../../scripts/config/WaveConfig';
import { UINode } from '../../scripts/ui/core/UINode';
import { mountBattleHUD } from '../../scripts/ui/index';
import { MapRenderer } from './MapRenderer';
import { AutoTowerAI } from '../../scripts/battle/AutoTowerAI';
import { DicePanelUI } from './DicePanelUI';
import { GachaPanelUI } from './GachaPanelUI';
import { TowerPickPanelUI } from './TowerPickPanelUI';
import { ShopPanelUI } from './ShopPanelUI';
import { SettlementPanelUI } from './SettlementPanelUI';
import { TowerOpPanelUI } from './TowerOpPanelUI';
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
    @property(Prefab) towerOpPanelPrefab: Prefab | null = null;

    private _battle: BattleManager | null = null;
    private _ai: AutoTowerAI | null = null;
    private _lastShopData: any = {};
    private _lastShopTier: string = '';

    start(): void {
        UIManager.attachRoot(this.node);

        // 全屏底色，盖住所有空白区域
        const bg = UINode.panel({
            name: 'GlobalBg',
            size: { w: 1500, h: 900 },
            color: '1A1A2EFF',
        });
        this.node.insertChild(bg, 0); // 插入到最底层

        GameRoot.boot();
        this._battle = GameRoot.startBattle({ seed: Date.now() | 0, difficulty: 2, players: [{ id: 'player1', name: '测试玩家' }] });
        mountBattleHUD({ battle: this._battle, playerId: 'player1', online: false });
        if (this.mapLayer) { const r = this.mapLayer.getComponent(MapRenderer); if (r) r.draw((this._battle as any).map); }
        this._ai = new AutoTowerAI({ playerId: 'player1', battle: this._battle });
        this._bindDice();
        this._bindGacha();
        this._bindShop();
        this._bindSettle();
        this._bindTowerOp();

        // 退出对局 → 返回大厅
        EventBus.on('battle_quit_request', () => {
            director.loadScene('MainMenu');
        });
    }

    update(_dt: number): void { TimeManager.update(_dt); if (this._ai) this._ai.tick(TimeManager.logicDtMs); }

    private _bindDice(): void {
        EventBus.on('dice_pick_selected', (data: any) => {
            if (this._battle) this._battle.diceSys.applyPick(data.playerId, data.selected);
            EventBus.emit('wave_inter_event_done', { playerId: data.playerId });
        });
    }

    private _bindGacha(): void {
        EventBus.on('wave_settle', (settle: any) => {
            const gachas = settle.gachas || [], dices = settle.dices || [], towerPicks = settle.towerPicks || [];
            const finalDone = () => { TimeManager.resume(); EventBus.emit('wave_inter_event_done', { playerId: 'player1' }); };
            if (settle.wave >= TOTAL_WAVES) { finalDone(); return; }
            const runQueue = () => {
                TimeManager.pause();
                const next = () => { if (settle.shop) this._showShopPanel(finalDone); else finalDone(); };
                if (towerPicks.length > 0) this._showTowerPickPanel(towerPicks[0], () => {
                    if (gachas.length > 0) this._showGachaPanel(gachas[0], () => { if (dices.length > 0) this._showDicePanel(dices[0], next); else next(); });
                    else if (dices.length > 0) this._showDicePanel(dices[0], next); else next();
                });
                else if (gachas.length > 0) this._showGachaPanel(gachas[0], () => { if (dices.length > 0) this._showDicePanel(dices[0], next); else next(); });
                else if (dices.length > 0) this._showDicePanel(dices[0], next); else next();
            }; runQueue();
        });
    }

    private _showTowerPickPanel(data: any, onDone: () => void): void {
        if (!this.towerPickPanelPrefab) { onDone(); return; }
        const node = instantiate(this.towerPickPanelPrefab); UIManager.pushPopup(node);
        const ui = node.getComponent(TowerPickPanelUI); if (!ui) { onDone(); return; }
        ui.show(data);
        const h = (r: any) => { EventBus.off('tower_pick_selected', h); if (this._battle) this._battle.pickSys.pick(r.playerId, r.selected); onDone(); };
        EventBus.on('tower_pick_selected', h);
    }
    private _showGachaPanel(data: any, onDone: () => void): void {
        if (!this.gachaPanelPrefab) { onDone(); return; }
        const node = instantiate(this.gachaPanelPrefab); UIManager.pushPopup(node);
        const ui = node.getComponent(GachaPanelUI); if (ui) ui.show(data);
        const h = () => { EventBus.off('gacha_confirmed', h); onDone(); }; EventBus.on('gacha_confirmed', h);
    }
    private _showDicePanel(data: any, onDone?: () => void): void {
        if (!this.dicePanelPrefab) { onDone?.(); return; }
        const node = instantiate(this.dicePanelPrefab); UIManager.pushPopup(node);
        const ui = node.getComponent(DicePanelUI); if (ui) ui.show(data);
        const h = () => { EventBus.off('dice_pick_selected', h); if (onDone) onDone(); }; EventBus.on('dice_pick_selected', h);
    }
    private _showShopPanel(onDone: () => void): void {
        if (!this.shopPanelPrefab) { onDone(); return; }
        const node = instantiate(this.shopPanelPrefab); UIManager.pushPopup(node);
        const ui = node.getComponent(ShopPanelUI); if (ui) ui.show({ playerId: 'player1', battle: this._battle!, perPlayer: this._lastShopData, tier: this._lastShopTier });
        const h = () => { EventBus.off('shop_closed', h); onDone(); }; EventBus.on('shop_closed', h);
    }
    private _bindShop(): void { EventBus.on('shop_open', (d: any) => { this._lastShopData = d.perPlayer?.player1 || {}; this._lastShopTier = d.tier || ''; }); }
    private _bindSettle(): void {
        EventBus.on('battle_end', (r: any) => {
            if (!this.settlementPanelPrefab) return;
            const node = instantiate(this.settlementPanelPrefab); UIManager.pushPopup(node);
            const ui = node.getComponent(SettlementPanelUI); if (ui) ui.show(r);
        });
    }
    private _currentTowerOpNode: Node | null = null;

    private _bindTowerOp(): void {
        EventBus.on('tower_clicked', (data: any) => {
            if (!this.towerOpPanelPrefab || !this._battle) return;
            if ((this._battle as any).state !== 'FIGHTING') return;

            // 有非塔面板的弹窗时不响应（骰子/商店等）
            const otherPopups = UIManager.popupStack.filter(n => n !== this._currentTowerOpNode);
            if (otherPopups.length > 0) return;

            if (this._currentTowerOpNode) {
                this._currentTowerOpNode.destroy();
                this._currentTowerOpNode = null;
            }

            const node = instantiate(this.towerOpPanelPrefab);
            UIManager.pushPopup(node);
            const ui = node.getComponent(TowerOpPanelUI);
            if (ui) ui.show({ tower: data.tower, playerId: 'player1', battle: this._battle });

            this._currentTowerOpNode = node;
            const onDestroy = () => { if (this._currentTowerOpNode === node) this._currentTowerOpNode = null; };
            node.once(Node.EventType.NODE_DESTROYED, onDestroy);
        });

        EventBus.on('pause_enter', () => { if (this._currentTowerOpNode) { this._currentTowerOpNode.destroy(); this._currentTowerOpNode = null; } });
        EventBus.on('wave_settle', () => { if (this._currentTowerOpNode) { this._currentTowerOpNode.destroy(); this._currentTowerOpNode = null; } });
    }
}
