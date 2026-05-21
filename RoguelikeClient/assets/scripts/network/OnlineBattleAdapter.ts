/**
 * 联机战斗适配器
 * ---------------------------------------------------------------
 * 处理三件事：
 *   1) 把本地玩家操作打包发服务端
 *   2) 接收服务端 frame_broadcast → 应用其他玩家的操作
 *   3) 接收服务端 dice_result / gacha_result → 应用到 BuffManager
 *
 * 乐观执行 + 服务端确认：
 *   - 本地操作立即在客户端生效（applyOptimistic=true）
 *   - 同时记录到 _pendingConfirm，等服务端 frame_broadcast 包含此 action 即确认
 *   - 超过 N 帧（默认 30 帧 ≈ 2 秒）未确认 → 触发回滚事件 'battle_action_rollback'
 *     （UI 层可接此事件给玩家提示并回滚视觉表现）
 *
 * 注：当前服务端是"单纯转发"模型，不会拒绝业务操作。回滚机制是为
 *     未来"服务端校验"留接口；同时也覆盖丢包场景。
 */

import { instance as EventBus } from '../core/EventBus';
import { MessageType, ActionType } from '@rtd/shared';
import { Logger } from '../utils/Logger';
import type { BattleManager } from '../battle/BattleManager';
import type { NetworkClient } from './NetworkClient';

export interface OnlineCtx {
    battle: BattleManager;
    net: NetworkClient;
    localPlayerId: string;
    applyOptimistic?: boolean;
    /** 等待服务端确认的最大帧数；超过则视为丢包并触发回滚事件 */
    confirmTimeoutFrames?: number;
}

interface ActionPayload {
    type: string;
    pid?: string;
    [key: string]: unknown;
}

interface PendingAction {
    action: ActionPayload;
    sentFrame: number;
}

export class OnlineBattleAdapter {
    public battle: BattleManager;
    public net: NetworkClient;
    public localPlayerId: string;
    public applyOptimistic: boolean;
    public confirmTimeoutFrames: number;

    public localPending: ActionPayload[] = [];
    /** 当前帧待发送 */
    private _pendingConfirm: PendingAction[] = [];
    /** 已 ack 的最大服务端帧 ID */
    private _lastAckFrame: number = -1;
    /** 当前逻辑帧（与 BattleManager 同步） */
    private _curFrame: number = 0;

    private _lastHashWave: number = 0;

    constructor(ctx: OnlineCtx) {
        this.battle = ctx.battle;
        this.net = ctx.net;
        this.localPlayerId = ctx.localPlayerId;
        this.applyOptimistic = ctx.applyOptimistic !== false;
        this.confirmTimeoutFrames = ctx.confirmTimeoutFrames || 30;
        this._bindEvents();
        this._patchBattle();
    }

    private _bindEvents(): void {
        EventBus.on('ws:' + MessageType.DICE_RESULT,    (data: any) => this._onDiceResult(data));
        EventBus.on('ws:' + MessageType.GACHA_RESULT,   (data: any) => this._onGachaResult(data));
        EventBus.on('ws:' + MessageType.FRAME_BROADCAST,(data: any) => this._onFrame(data));
        EventBus.on('ws:' + MessageType.STATE_DESYNC,   (data: any) => {
            EventBus.emit('battle_desync_warning', data);
            Logger.warn('OnlineBattle', 'desync notice', data);
        });
        EventBus.on('ws:' + MessageType.GAME_OVER,      (data: any) => {
            EventBus.emit('battle_remote_over', data);
        });

        EventBus.on('logic_tick', (frameId: number) => {
            this._curFrame = frameId;
            const actions = this.localPending.length > 0
                ? this.localPending
                : [{ type: ActionType.EMPTY }];
            // 记录待确认
            for (const a of actions) {
                if (a.type !== ActionType.EMPTY) {
                    this._pendingConfirm.push({ action: a, sentFrame: frameId });
                }
            }
            this.localPending = [];
            this.net.sendFrameInput(frameId, actions);
            // 检查超时未确认的（视为丢包）
            this._checkTimeouts();
        });

        EventBus.on('wave_end', async ({ wave, isBoss }: { wave: number; isBoss: boolean }) => {
            if (this._lastHashWave !== wave) {
                this._lastHashWave = wave;
                if (wave % 3 === 0) this._reportStateHash(wave);
            }
            try {
                await this.net.rollDice(wave);
                if (wave % 3 === 0 || isBoss) await this.net.drawGacha(wave);
            } catch (e: any) {
                Logger.warn('OnlineBattle', 'wave_end rpc fail', e?.message);
            }
        });

        EventBus.on('battle_end', (result: any) => {
            const isHost = this.battle.players[0].id === this.localPlayerId;
            if (isHost) this.net.submitGameOver(result).catch((e: any) => Logger.warn('OnlineBattle', 'submit game over', e?.message));
        });
    }

    private _patchBattle(): void {
        const origBuild     = this.battle.build.bind(this.battle);
        const origUpgrade   = this.battle.upgrade.bind(this.battle);
        const origSell      = this.battle.sell.bind(this.battle);
        const origUseItem   = this.battle.useItem.bind(this.battle);
        const origMode      = this.battle.switchMode.bind(this.battle);
        const origShopBuy   = this.battle.shopBuy.bind(this.battle);
        const origShopClose = this.battle.shopClose.bind(this.battle);

        this.battle.build = ((pid: string, type: any, x: number, y: number) => {
            this._pushAction({ type: ActionType.PLACE_TOWER, pid, towerType: type, x, y });
            return this.applyOptimistic ? origBuild(pid, type, x, y) : { ok: true, deferred: true } as any;
        }) as any;
        this.battle.upgrade = ((pid: string, towerId: string) => {
            this._pushAction({ type: ActionType.UPGRADE_TOWER, pid, towerId });
            return this.applyOptimistic ? origUpgrade(pid, towerId) : { ok: true, deferred: true } as any;
        }) as any;
        this.battle.sell = ((pid: string, towerId: string) => {
            this._pushAction({ type: ActionType.SELL_TOWER, pid, towerId });
            return this.applyOptimistic ? origSell(pid, towerId) : { ok: true, deferred: true } as any;
        }) as any;
        this.battle.useItem = ((pid: string, itemId: string) => {
            this._pushAction({ type: ActionType.USE_ITEM, pid, itemId });
            return this.applyOptimistic ? origUseItem(pid, itemId) : { ok: true, deferred: true } as any;
        }) as any;
        this.battle.switchMode = ((pid: string, towerId: string, m: any) => {
            this._pushAction({ type: ActionType.SWITCH_TARGET_MODE, pid, towerId, mode: m });
            return this.applyOptimistic ? origMode(pid, towerId, m) : { ok: true, deferred: true } as any;
        }) as any;
        this.battle.shopBuy = ((pid: string, slot: number, extra?: any) => {
            this._pushAction({ type: ActionType.SHOP_BUY, pid, slot, extra });
            return this.applyOptimistic ? origShopBuy(pid, slot, extra) : { ok: true, deferred: true } as any;
        }) as any;
        this.battle.shopClose = ((pid: string) => {
            this._pushAction({ type: ActionType.SHOP_CLOSE, pid });
            return this.applyOptimistic ? origShopClose(pid) : true;
        }) as any;

        // 联机模式：本地骰子/抽卡停用，等服务端结果
        (this.battle.diceSys as any).rollOnce = () => ({ dice: 0, picks: [], allyTargets: {}, deferred: true });
        (this.battle.gachaSys as any).draw    = () => ({ card: null, refundedGold: 0, deferred: true });
    }

    private _pushAction(action: ActionPayload): void {
        if (action.pid !== this.localPlayerId) return;
        this.localPending.push(action);
    }

    private _onFrame(data: any): void {
        if (!data || !data.inputs) return;
        if (typeof data.frameId === 'number') this._lastAckFrame = data.frameId;
        for (const [pid, actions] of Object.entries(data.inputs) as Array<[string, ActionPayload[]]>) {
            // 自己的：从待确认列表中摘除（已被服务端 ack）
            if (pid === this.localPlayerId) {
                this._ackOwnActions(actions || []);
                if (this.applyOptimistic) continue; // 已乐观执行
            }
            for (const a of actions || []) {
                if (a.type === ActionType.EMPTY) continue;
                this._applyAction(pid, a);
            }
        }
    }

    /** 把服务端确认包含的本地 action 从待确认列表中移除 */
    private _ackOwnActions(actions: ActionPayload[]): void {
        if (!actions || actions.length === 0) return;
        for (const a of actions) {
            if (a.type === ActionType.EMPTY) continue;
            const idx = this._pendingConfirm.findIndex((p) => actionsEqual(p.action, a));
            if (idx >= 0) this._pendingConfirm.splice(idx, 1);
        }
    }

    /** 检查超时未被服务端 ack 的 action → 触发回滚事件 */
    private _checkTimeouts(): void {
        const cutoff = this._curFrame - this.confirmTimeoutFrames;
        const stale: PendingAction[] = [];
        this._pendingConfirm = this._pendingConfirm.filter((p) => {
            if (p.sentFrame < cutoff) {
                stale.push(p);
                return false;
            }
            return true;
        });
        if (stale.length > 0) {
            Logger.warn('OnlineBattle', 'rollback', stale.length, 'stale actions');
            EventBus.emit('battle_action_rollback', { actions: stale.map((s) => s.action) });
        }
    }

    private _applyAction(pid: string, a: any): void {
        switch (a.type) {
            case ActionType.PLACE_TOWER:        this.battle.towerCtl.build(pid, a.towerType, a.x, a.y); break;
            case ActionType.UPGRADE_TOWER:      this.battle.towerCtl.upgrade(pid, a.towerId); break;
            case ActionType.SELL_TOWER:         this.battle.towerCtl.sell(pid, a.towerId); break;
            case ActionType.USE_ITEM:           this.battle.itemCtl.use(pid, a.itemId); break;
            case ActionType.SWITCH_TARGET_MODE: this.battle.towerCtl.switchTargetMode(pid, a.towerId, a.mode); break;
            case ActionType.SHOP_BUY:           this.battle.shopCtl.buy(pid, a.slot, a.extra); break;
            case ActionType.SHOP_CLOSE:         this.battle.shopCtl.close(pid); break;
            default: break;
        }
    }

    private _onDiceResult(data: any): void {
        const { playerId, picks, allyTargets } = data;
        for (const card of picks || []) {
            const target = card.effect && card.effect.target;
            if (target === 'RANDOM_ALLY') {
                const allyId = allyTargets && allyTargets[card.id];
                if (allyId && allyId !== '__resisted__') this.battle.buffs.applyEffect(allyId, card);
            } else {
                this.battle.buffs.applyEffect(playerId, card);
            }
        }
        EventBus.emit('dice_rolled', data);
    }

    private _onGachaResult(data: any): void {
        const { playerId, card, refundedGold } = data;
        if (refundedGold && refundedGold > 0) {
            this.battle.economy.addGold(playerId, refundedGold, 'gacha_dup');
        } else if (card) {
            this.battle.buffs.applyEffect(playerId, card);
        }
        EventBus.emit('gacha_drawn', data);
    }

    private _reportStateHash(wave: number): void {
        const towers = Array.from(this.battle.em.towers.values())
            .map((t) => `${t.ownerId}|${t.x}|${t.y}|${t.type}|${t.level}|${Math.round(t.growth.atk || 0)}`)
            .sort()
            .join(';');
        const econ = this.battle.players.map((p) => p.id + ':' + this.battle.economy.getGold(p.id)).sort().join(',');
        const crystal = this.battle.crystal.hp + '/' + this.battle.crystal.shield;
        const text = `w${wave}|${crystal}|${econ}|${towers}`;
        this.net.reportStateHash(wave, simpleHash(text));
    }
}

/** 简易 action 等价判定（type + 关键字段一致即认为是同一个） */
function actionsEqual(a: ActionPayload, b: ActionPayload): boolean {
    if (a.type !== b.type) return false;
    const keys = ['pid', 'towerId', 'towerType', 'x', 'y', 'itemId', 'slot', 'mode'];
    for (const k of keys) {
        if (a[k] !== undefined || b[k] !== undefined) {
            if (a[k] !== b[k]) return false;
        }
    }
    return true;
}

function simpleHash(s: string): string {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(16);
}
