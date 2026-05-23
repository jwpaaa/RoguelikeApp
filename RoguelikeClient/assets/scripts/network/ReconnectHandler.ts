/**
 * 断线重连
 */

import { instance as EventBus } from '../core/EventBus';
import { Logger } from '../utils/Logger';
import { MessageType } from '../../shared/index';
import type { WebSocketClient } from './WebSocketClient';

export const RECONNECT_TIMEOUT_MS = 120 * 1000;
export const HEARTBEAT_TIMEOUT_MS = 5 * 1000;

export interface RoomContext {
    roomId?: string;
    playerId?: string;
    token: string;
    openid?: string;
    lastFrame?: number;
}

export class ReconnectHandler {
    public client: WebSocketClient;
    private _reconnectStartTs: number = 0;
    private _lastHeartbeatMs: number = Date.now();
    private _roomCtx: RoomContext | null = null;
    private _timer: ReturnType<typeof setInterval> | null = null;

    constructor(ctx: { client: WebSocketClient }) {
        this.client = ctx.client;
        EventBus.on('ws_close', () => this._onClose());
        EventBus.on('ws_open',  () => this._onOpen());
        EventBus.on('ws:' + MessageType.PONG, () => { this._lastHeartbeatMs = Date.now(); });
    }

    setRoomContext(ctx: RoomContext): void { this._roomCtx = ctx; }

    setLastFrame(frameId: number): void {
        if (this._roomCtx) this._roomCtx.lastFrame = frameId;
    }

    checkHeartbeat(): void {
        const dt = Date.now() - this._lastHeartbeatMs;
        if (dt > HEARTBEAT_TIMEOUT_MS && this.client.isConnected()) {
            Logger.warn('Reconnect', 'heartbeat timeout, treating as disconnect');
            this.client.close();
        }
    }

    private _onClose(): void {
        if (!this._roomCtx) return;
        this._reconnectStartTs = Date.now();
        EventBus.emit('reconnect_start');
        if (this._timer) clearInterval(this._timer);
        this._timer = setInterval(() => {
            const elapsed = Date.now() - this._reconnectStartTs;
            if (elapsed > RECONNECT_TIMEOUT_MS) {
                clearInterval(this._timer!);
                this._timer = null;
                EventBus.emit('reconnect_failed', { elapsed });
            }
        }, 1000);
    }

    private _onOpen(): void {
        if (!this._roomCtx) return;
        if (this._reconnectStartTs > 0) {
            this.client.send(MessageType.RECONNECT, this._roomCtx).then((rsp: any) => {
                if (rsp && rsp.data && rsp.data.frames) this.applyCatchupFrames(rsp.data.frames);
                EventBus.emit('reconnect_success');
                this._reconnectStartTs = 0;
                if (this._timer) { clearInterval(this._timer); this._timer = null; }
            }).catch((err: unknown) => {
                Logger.error('Reconnect', 'reconnect failed', err);
                EventBus.emit('reconnect_failed', { err });
            });
        }
    }

    /** 重放追帧数据 */
    applyCatchupFrames(frames: unknown[]): void {
        EventBus.emit('reconnect_catchup', { frames });
    }
}
