/**
 * 观战系统（来自需求文档 §F-4.7）
 */

import { instance as EventBus } from '../core/EventBus';
import { MessageType } from '@rtd/shared';
import type { NetworkClient } from '../network/NetworkClient';

export interface SpectatorCtx {
    client: NetworkClient;
    delaySec?: number;
}

export class SpectatorManager {
    public client: NetworkClient;
    public delaySec: number;
    public targetPlayerId: string | null = null;
    public pending: Array<{ recvTs: number; frame: any }> = [];
    private _timer: ReturnType<typeof setInterval> | null = null;

    constructor(ctx: SpectatorCtx) {
        this.client = ctx.client;
        this.delaySec = ctx.delaySec || 20;
        EventBus.on('ws:' + MessageType.SPECTATE_FRAME, (data: any) => this._onFrame(data));
    }

    join(targetPlayerId: string): void {
        this.targetPlayerId = targetPlayerId;
        this.pending.length = 0;
        this.client.send(MessageType.SPECTATE_JOIN, { targetPlayerId });
        this._timer = setInterval(() => this._flush(), 100);
        EventBus.emit('spectate_started', { targetPlayerId, delaySec: this.delaySec });
    }

    leave(): void {
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
        this.client.send(MessageType.SPECTATE_LEAVE, { targetPlayerId: this.targetPlayerId });
        this.targetPlayerId = null;
        this.pending.length = 0;
        EventBus.emit('spectate_ended');
    }

    private _onFrame(data: any): void {
        this.pending.push({ recvTs: Date.now(), frame: data });
    }

    private _flush(): void {
        const cutoff = Date.now() - this.delaySec * 1000;
        while (this.pending.length > 0 && this.pending[0].recvTs <= cutoff) {
            const item = this.pending.shift()!;
            EventBus.emit('spectate_replay_frame', item.frame);
        }
    }
}
