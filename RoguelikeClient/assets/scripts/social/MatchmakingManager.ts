/**
 * 快速匹配（来自需求文档 §F-1.4）
 */

import { instance as EventBus } from '../core/EventBus';
import { MessageType } from '../../shared/index';
import type { NetworkClient } from '../network/NetworkClient';

export const MATCH_TIMEOUT_MS = 15000;

export const MatchStatus = Object.freeze({
    IDLE:       'IDLE',
    SEARCHING:  'SEARCHING',
    AI_PROMPT:  'AI_PROMPT',
    SUCCESS:    'SUCCESS',
    CANCELED:   'CANCELED',
});

export type MatchStatusValue = typeof MatchStatus[keyof typeof MatchStatus];

export interface MatchStartOpts {
    difficulty?: number;
    allowAi?: boolean;
}

export class MatchmakingManager {
    public client: NetworkClient | null;
    public status: MatchStatusValue = MatchStatus.IDLE;
    private _startedTs: number = 0;
    private _timer: ReturnType<typeof setTimeout> | null = null;
    private _allowAi: boolean = false;

    constructor(ctx: { client: NetworkClient }) {
        this.client = ctx.client;
        EventBus.on('ws:' + MessageType.MATCH_RSP, (data: { success: boolean }) => this._onRsp(data));
    }

    start(opts: MatchStartOpts): void {
        this.status = MatchStatus.SEARCHING;
        this._startedTs = Date.now();
        this._allowAi = !!opts.allowAi;
        if (this.client) this.client.send(MessageType.START_MATCH, opts).catch(() => { /* swallow */ });
        this._timer = setTimeout(() => {
            if (this.status === MatchStatus.SEARCHING) {
                if (this._allowAi) {
                    EventBus.emit('match_ai_fill_request');
                    this.status = MatchStatus.AI_PROMPT;
                } else {
                    this.cancel('timeout');
                }
            }
        }, MATCH_TIMEOUT_MS);
        EventBus.emit('match_started');
    }

    acceptAi(): void {
        if (this.client) this.client.send(MessageType.START_MATCH, { allowAi: true, forceAi: true }).catch(() => { /* swallow */ });
    }

    cancel(reason?: string): void {
        if (this._timer) { clearTimeout(this._timer); this._timer = null; }
        if (this.status === MatchStatus.SEARCHING && this.client) {
            this.client.send(MessageType.CANCEL_MATCH, {}).catch(() => { /* swallow */ });
        }
        this.status = MatchStatus.CANCELED;
        EventBus.emit('match_canceled', { reason });
    }

    private _onRsp(data: { success: boolean }): void {
        if (this._timer) { clearTimeout(this._timer); this._timer = null; }
        if (data && data.success) {
            this.status = MatchStatus.SUCCESS;
            EventBus.emit('match_success', data);
        }
    }

    elapsedMs(): number { return this._startedTs > 0 ? Date.now() - this._startedTs : 0; }
}
