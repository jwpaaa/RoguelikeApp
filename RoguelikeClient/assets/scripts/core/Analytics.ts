/**
 * 埋点上报 / FTUE 漏斗（来自需求文档 §11 + §F-0.5）
 * ---------------------------------------------------------------
 * 统一埋点入口，所有事件名带 rtd_ 前缀。
 * 默认每 10 条 / 每 30 秒批量上报一次。
 */

import { Logger } from '../utils/Logger';
import { instance as EventBus } from './EventBus';
import { instance as User } from '../data/UserDataManager';

const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 30000;

export interface AnalyticsEvent {
    event_name: string;
    timestamp: number;
    session_id: string;
    player_id: string;
    data: Record<string, unknown>;
    // 由 BattleManager 注入的字段
    room_id?: string;
    wave_number?: number;
    difficulty?: number;
}

export type Reporter = (events: AnalyticsEvent[]) => void;

export class Analytics {
    private _buf: AnalyticsEvent[];
    private _reporter: Reporter | null;
    private readonly _sessionId: string;
    private _timer: ReturnType<typeof setInterval> | null;
    private _currentBattleCtx: Partial<AnalyticsEvent> | null;

    constructor() {
        this._buf = [];
        this._reporter = null;
        this._sessionId = (Date.now() & 0xFFFFFFFF).toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36);
        this._timer = null;
        this._currentBattleCtx = null;
        this._autoBindEvents();
    }

    setReporter(fn: Reporter): void {
        this._reporter = fn;
        if (!this._timer) this._timer = setInterval(() => this._flush(), FLUSH_INTERVAL_MS);
    }

    track(eventName: string, data?: Record<string, unknown>): void {
        if (!eventName) return;
        const evt: AnalyticsEvent = {
            event_name: eventName.startsWith('rtd_') ? eventName : 'rtd_' + eventName,
            timestamp: Date.now(),
            session_id: this._sessionId,
            player_id: User.data.openid || 'guest',
            data: data || {},
        };
        if (this._currentBattleCtx) Object.assign(evt, this._currentBattleCtx);
        this._buf.push(evt);
        Logger.debug('Analytics', evt.event_name, evt.data);
        if (this._buf.length >= BATCH_SIZE) this._flush();
    }

    /** 进入对局时由 BattleManager 调用 */
    setBattleContext(ctx: Partial<AnalyticsEvent> | null): void {
        this._currentBattleCtx = ctx ? { ...ctx } : null;
    }

    private _flush(): void {
        if (this._buf.length === 0) return;
        const batch = this._buf.slice();
        this._buf.length = 0;
        if (this._reporter) {
            try { this._reporter(batch); }
            catch { /* 上报失败：丢弃 */ }
        }
    }

    private _autoBindEvents(): void {
        EventBus.on('battle_start', (b: any) => {
            this.setBattleContext({ room_id: b.players.length > 1 ? 'mp' : 'sp', wave_number: 0, difficulty: b.difficulty });
            this.track('rtd_battle_start', { difficulty: b.difficulty, players: b.players.length, seed: b.seed });
        });
        EventBus.on('wave_start', ({ wave }: { wave: number }) => {
            if (this._currentBattleCtx) this._currentBattleCtx.wave_number = wave;
            this.track('rtd_wave_start', { wave });
        });
        EventBus.on('wave_end', (data: any) => this.track('rtd_wave_end', data));
        EventBus.on('tower_built',    (t: any) => this.track('rtd_tower_build',   { type: t.type, x: t.x, y: t.y }));
        EventBus.on('tower_upgraded', (t: any) => this.track('rtd_tower_upgrade', { type: t.type, level: t.level }));
        EventBus.on('tower_sold',     ({ tower, refund }: any) => this.track('rtd_tower_sell', { type: tower.type, refund }));
        EventBus.on('item_used',      ({ itemId }: any) => this.track('rtd_item_use', { itemId }));
        EventBus.on('dice_rolled',    ({ dice, picks }: any) => this.track('rtd_dice_roll', { dice, picks: picks.map((p: any) => p.id) }));
        EventBus.on('gacha_drawn',    ({ card, refundedGold }: any) => this.track('rtd_gacha_draw', { rarity: card?.rarity, id: card?.id, refunded: refundedGold }));
        EventBus.on('battle_end',     (r: any) => {
            this.track(r.win ? 'rtd_battle_win' : 'rtd_battle_lose', { wave: r.wave, score: r.score?.score, grade: r.score?.grade, kills: r.kills });
            this.setBattleContext(null);
            this._flush();
        });
        EventBus.on('shop_bought',    ({ slotIdx, goods, finalPrice }: any) => this.track('rtd_purchase_success', { id: goods.id, kind: goods.kind, price: finalPrice }));
        EventBus.on('random_event',   ({ event, wave }: any) => this.track('rtd_random_event', { id: event.id, wave }));
        EventBus.on('reconnect_start',   () => this.track('rtd_disconnect'));
        EventBus.on('reconnect_success', () => this.track('rtd_reconnect'));
        EventBus.on('reconnect_failed',  (d: any) => this.track('rtd_reconnect_failed', d));
    }

    /** FTUE 步骤标记（外部直接调用） */
    static ftueStep(step: number | string): void {
        instance.track('rtd_ftue_step_' + step, { step });
    }
}

export const instance = new Analytics();
