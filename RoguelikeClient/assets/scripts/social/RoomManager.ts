/**
 * 房间管理（来自需求文档 §F-1.3）
 * ---------------------------------------------------------------
 * 单机模式：本地直接 mock。
 * 联机模式：通过 NetworkClient 与服务端通信。
 */

import { instance as EventBus } from '../core/EventBus';
import { instance as User } from '../data/UserDataManager';
import { MessageType } from '@rtd/shared';
import type { NetworkClient } from '../network/NetworkClient';

export const RoomState = Object.freeze({
    IDLE:     'IDLE',
    WAITING:  'WAITING',
    READY:    'READY',
    PLAYING:  'PLAYING',
    FINISHED: 'FINISHED',
});

export type RoomStateValue = typeof RoomState[keyof typeof RoomState];

export interface RoomData {
    roomId: string;
    hostId: string;
    players: Array<{ id: string; name?: string; ready: boolean; host: boolean; online?: boolean; isAi?: boolean }>;
    difficulty: number;
    maxPlayers: number;
    seed: number;
    isLocal?: boolean;
}

export class RoomManager {
    public state: RoomStateValue = RoomState.IDLE;
    public room: RoomData | null = null;
    public client: NetworkClient | null = null;

    bindClient(client: NetworkClient): void {
        this.client = client;
        EventBus.on('ws:' + MessageType.ROOM_UPDATE, (data: any) => {
            if (data && data.room) this.onServerUpdate(data.room);
        });
    }

    /** 单机：本地创建 1 人房间 */
    createLocal({ difficulty }: { difficulty: number }): RoomData {
        const roomId = String(Math.floor(100000 + Math.random() * 900000));
        const seed = (Date.now() & 0xFFFFFFFF) ^ Math.floor(Math.random() * 0xFFFFFFFF);
        this.room = {
            roomId,
            hostId: User.data.openid || 'local',
            players: [{ id: User.data.openid || 'local', name: User.data.nickname, ready: true, host: true }],
            difficulty,
            maxPlayers: 1,
            seed,
            isLocal: true,
        };
        this.state = RoomState.WAITING;
        EventBus.emit('room_update', this.room);
        return this.room;
    }

    async create({ difficulty, maxPlayers }: { difficulty: number; maxPlayers: number }): Promise<any> {
        if (!this.client) throw new Error('no_client');
        const r = await this.client.createRoom({ name: User.data.nickname, difficulty, maxPlayers });
        if (r && r.room) this.onServerUpdate(r.room);
        return r;
    }

    async join(roomId: string): Promise<any> {
        if (!this.client) throw new Error('no_client');
        const r = await this.client.joinRoom(roomId);
        if (r && r.room) this.onServerUpdate(r.room);
        return r;
    }

    async leave(): Promise<void> {
        if (this.client && this.room && !this.room.isLocal) {
            try { await this.client.leaveRoom(); } catch { /* swallow */ }
        }
        this.room = null;
        this.state = RoomState.IDLE;
        EventBus.emit('room_update', null);
    }

    async setReady(ready: boolean): Promise<void> {
        if (this.client && this.room && !this.room.isLocal) {
            try { await this.client.setReady(ready); } catch { /* swallow */ }
        }
        if (this.room) {
            const me = this.room.players.find((p) => p.id === User.data.openid);
            if (me) me.ready = !!ready;
            EventBus.emit('room_update', this.room);
        }
    }

    async kick(targetId: string): Promise<any> {
        if (!this.client || !this.room) return;
        return this.client.kick(targetId);
    }

    /** 服务端推送的房间更新 */
    onServerUpdate(room: RoomData): void {
        this.room = room;
        if (room.players && room.players.every((p) => p.ready)) this.state = RoomState.READY;
        EventBus.emit('room_update', this.room);
    }
}

export const instance = new RoomManager();
