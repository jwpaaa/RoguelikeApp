/**
 * 网络客户端 — 联机入口（单例）
 */

import { WebSocketClient } from './WebSocketClient';
import { ReconnectHandler } from './ReconnectHandler';
import { PingMonitor } from './PingMonitor';
import { MessageType } from '../../shared/index';
import { instance as EventBus } from '../core/EventBus';
import { Logger } from '../utils/Logger';
import { Storage } from '../utils/Storage';

const TOKEN_KEY = 'rtd_auth_token';

export interface LoginPayload {
    code: string;
    nickname?: string;
    avatar?: string;
}

export interface AuthRsp {
    openid: string;
    token: string;
    profile: any;
}

export class NetworkClient {
    public ws: WebSocketClient | null = null;
    public reconnect: ReconnectHandler | null = null;
    public ping: PingMonitor | null = null;

    public openid: string | null = null;
    public token: string | null = null;
    public profile: any = null;
    public isAuthed: boolean = false;

    isOnline(): boolean { return !!(this.ws && this.ws.isConnected() && this.isAuthed); }

    async connect(url: string): Promise<boolean> {
        if (this.ws && this.ws.isConnected()) return true;
        this.ws = new WebSocketClient(url);
        this.reconnect = new ReconnectHandler({ client: this.ws });
        this.ping = new PingMonitor({ client: this.ws });
        this.ws.connect();
        return new Promise<boolean>((resolve, reject) => {
            const offOpen = EventBus.on('ws_open', () => {
                offOpen();
                offErr();
                this.ping!.start();
                resolve(true);
            });
            const offErr = EventBus.on('ws_error', (err: unknown) => {
                offOpen();
                offErr();
                reject(err);
            });
            setTimeout(() => {
                offOpen(); offErr();
                if (this.ws!.isConnected()) resolve(true);
                else reject(new Error('connect_timeout'));
            }, 5000);
        });
    }

    async login(p: LoginPayload): Promise<AuthRsp> {
        if (!this.ws) throw new Error('not_connected');
        const rsp = await this.ws.send(MessageType.AUTH_LOGIN, p);
        if (!rsp || !rsp.data || !rsp.data.openid) throw new Error('login_failed');
        this.openid = rsp.data.openid;
        this.token  = rsp.data.token;
        this.profile = rsp.data.profile || null;
        this.isAuthed = true;
        Storage.set(TOKEN_KEY, this.token);
        if (this.reconnect) this.reconnect.setRoomContext({ token: this.token!, openid: this.openid! });
        EventBus.emit('network_authed', { openid: this.openid, profile: this.profile });
        Logger.info('Net', 'authed', this.openid);
        return rsp.data;
    }

    async resumeFromStorage(): Promise<boolean> {
        const tok = Storage.get(TOKEN_KEY) as string | null;
        if (!tok || !this.ws) return false;
        const rsp = await this.ws.send(MessageType.RECONNECT, { token: tok });
        if (rsp && rsp.data && rsp.data.success) {
            this.token = tok;
            this.isAuthed = true;
            return true;
        }
        return false;
    }

    // ---- 高层 API ----
    async createRoom(p: any):       Promise<any> { return this._call(MessageType.CREATE_ROOM, p); }
    async joinRoom(roomId: string): Promise<any> { return this._call(MessageType.JOIN_ROOM, { roomId }); }
    async leaveRoom():              Promise<any> { return this._call(MessageType.LEAVE_ROOM, {}); }
    async setReady(r: boolean):     Promise<any> { return this._call(MessageType.PLAYER_READY, { ready: !!r }); }
    async kick(targetId: string):   Promise<any> { return this._call(MessageType.KICK_PLAYER, { targetId }); }

    async startMatch(p: any):  Promise<any> { return this._call(MessageType.START_MATCH, p); }
    async cancelMatch():       Promise<any> { return this._call(MessageType.CANCEL_MATCH, {}); }

    async startBattle():       Promise<any> { return this._call(MessageType.BATTLE_START, {}); }

    sendFrameInput(frameId: number, actions: unknown[]): void {
        if (this.ws) this.ws.sendFireAndForget(MessageType.FRAME_INPUT, { frameId, actions });
    }

    async rollDice(waveNumber: number):  Promise<any> { return this._call('roll_dice', { waveNumber }); }
    async drawGacha(waveNumber: number): Promise<any> { return this._call('draw_gacha', { waveNumber }); }

    reportStateHash(waveNumber: number, hash: string): void {
        if (this.ws) this.ws.sendFireAndForget(MessageType.STATE_HASH, { waveNumber, hash });
    }

    async submitGameOver(result: any): Promise<any> { return this._call(MessageType.GAME_OVER, result); }
    async sendChat(text: string, quickIdx?: number): Promise<any> { return this._call(MessageType.CHAT_MESSAGE, { text, quickIdx }); }

    async spectateJoin(roomId: string):  Promise<any> { return this._call(MessageType.SPECTATE_JOIN, { roomId }); }
    async spectateLeave(roomId: string): Promise<any> { return this._call(MessageType.SPECTATE_LEAVE, { roomId }); }

    async getLeaderboard(field: string, limit: number): Promise<any> { return this._call('get_leaderboard', { field, limit }); }

    sendAnalytics(events: unknown[]): void {
        if (this.ws) this.ws.sendFireAndForget('analytics_batch', { events });
    }

    private async _call(type: string, data: any): Promise<any> {
        if (!this.ws) throw new Error('not_connected');
        const rsp = await this.ws.send(type, data || {});
        if (rsp && rsp.data && rsp.data.error) {
            const e: any = new Error(rsp.data.message || rsp.data.code || 'server_error');
            e.code = rsp.data.code;
            throw e;
        }
        return rsp ? rsp.data : null;
    }

    /** 透传给老 client 风格的代码 */
    send(type: string, data: unknown): Promise<any> {
        if (!this.ws) return Promise.reject(new Error('not_connected'));
        return this.ws.send(type, data || {});
    }
    sendFireAndForget(type: string, data: unknown): void {
        if (this.ws) this.ws.sendFireAndForget(type, data || {});
    }

    disconnect(): void {
        if (this.ping) this.ping.stop();
        if (this.ws)   this.ws.close();
        this.isAuthed = false;
        EventBus.emit('network_disconnect');
    }
}

export const instance = new NetworkClient();
