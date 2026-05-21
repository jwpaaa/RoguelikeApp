/**
 * 延迟监控（来自需求文档 §F-4.1）
 */

import { instance as EventBus } from '../core/EventBus';
import { MessageType } from '@rtd/shared';
import type { WebSocketClient } from './WebSocketClient';

export const PING_INTERVAL_MS = 5000;
export const WEAK_NETWORK_MS = 500;

export type PingLevel = 'green' | 'yellow' | 'red';

export class PingMonitor {
    public client: WebSocketClient;
    public lastRtt: number = 0;
    private _timer: ReturnType<typeof setInterval> | null = null;
    private _sentTs: number = 0;

    constructor(ctx: { client: WebSocketClient }) {
        this.client = ctx.client;
        EventBus.on('ws:' + MessageType.PONG, () => this._onPong());
    }

    start(): void {
        this.stop();
        this._timer = setInterval(() => {
            this._sentTs = Date.now();
            this.client.sendFireAndForget(MessageType.PING, {});
        }, PING_INTERVAL_MS);
    }

    stop(): void { if (this._timer) { clearInterval(this._timer); this._timer = null; } }

    private _onPong(): void {
        if (this._sentTs === 0) return;
        this.lastRtt = Date.now() - this._sentTs;
        EventBus.emit('ping_update', { rtt: this.lastRtt, level: this._level() });
        if (this.lastRtt > WEAK_NETWORK_MS) EventBus.emit('weak_network', { rtt: this.lastRtt });
    }

    private _level(): PingLevel {
        if (this.lastRtt < 50)  return 'green';
        if (this.lastRtt < 150) return 'yellow';
        return 'red';
    }
}
