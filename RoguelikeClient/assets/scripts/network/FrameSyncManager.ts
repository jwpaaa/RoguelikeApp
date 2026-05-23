/**
 * 帧同步管理（来自需求文档 §F-4.1）
 */

import { instance as EventBus } from '../core/EventBus';
import { MessageType, ActionType, type PlayerAction } from '../../shared/index';
import type { WebSocketClient } from './WebSocketClient';

export const FRAME_TIMEOUT_MS = 200;
export const OPTIMISTIC_FRAMES = 3;
export const INPUT_BUFFER = 10;

export interface FrameSyncCtx {
    client: WebSocketClient;
    roomId: string;
    playerId: string;
}

export interface ServerFrame {
    frameId: number;
    inputs: Record<string, PlayerAction[]>;
    serverTime: number;
    stateHash?: string;
}

export class FrameSyncManager {
    public client: WebSocketClient;
    public roomId: string;
    public playerId: string;
    public frameId: number = 0;
    public serverFrames: Map<number, ServerFrame> = new Map();
    public pendingActions: PlayerAction[] = [];

    constructor(ctx: FrameSyncCtx) {
        this.client = ctx.client;
        this.roomId = ctx.roomId;
        this.playerId = ctx.playerId;
        EventBus.on('ws:' + MessageType.FRAME_BROADCAST, (data: ServerFrame) => this._onServerFrame(data));
    }

    pushAction(action: PlayerAction): void { this.pendingActions.push(action); }

    /** 每个逻辑帧调用（66ms） */
    tickFrame(): void {
        const actions = this.pendingActions.length > 0
            ? this.pendingActions
            : [{ type: ActionType.EMPTY }];
        this.pendingActions = [];
        this.client.sendFireAndForget(MessageType.FRAME_INPUT, {
            roomId: this.roomId,
            frameId: this.frameId,
            actions,
        });
        this.frameId++;
    }

    private _onServerFrame(data: ServerFrame): void {
        this.serverFrames.set(data.frameId, data);
        EventBus.emit('frame_broadcast', data);
    }

    getConfirmedActions(frameId: number): ServerFrame | null {
        return this.serverFrames.get(frameId) || null;
    }

    reportStateHash(waveNumber: number, hash: string): void {
        this.client.sendFireAndForget('state_hash', { roomId: this.roomId, waveNumber, hash });
    }
}
