/**
 * WebSocket 客户端封装
 * ---------------------------------------------------------------
 * - 自动重连 / 心跳 30s
 * - send(type, data) → Promise<响应>
 * - sendFireAndForget(type, data) → 不等回包
 *
 * 跨端：微信小游戏 → wx.connectSocket；浏览器/Node → WebSocket
 */

import { instance as EventBus } from '../core/EventBus';
import { Logger } from '../utils/Logger';

declare const wx: undefined | {
    connectSocket: (opts: { url: string }) => any;
    onSocketOpen: (fn: () => void) => void;
    onSocketMessage: (fn: (res: { data: string }) => void) => void;
    onSocketError: (fn: (err: unknown) => void) => void;
    onSocketClose: (fn: () => void) => void;
    sendSocketMessage: (opts: { data: string }) => void;
    closeSocket: () => void;
};

const HEARTBEAT_MS = 30000;
const RECONNECT_INTERVAL_MS = 3000;
const SEND_TIMEOUT_MS = 10000;

interface Pending {
    resolve: (msg: any) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
}

type WSCtor = new (url: string) => {
    onopen: ((ev?: unknown) => void) | null;
    onmessage: ((ev: { data: unknown } | unknown) => void) | null;
    onerror: ((err: unknown) => void) | null;
    onclose: (() => void) | null;
    send: (data: string) => void;
    close: () => void;
};

export interface WsClientOpts { wsCtor?: WSCtor; }

export class WebSocketClient {
    public url: string;
    private _ws: any = null;
    private _connected: boolean = false;
    private _seq: number = 1;
    private _pending: Map<number, Pending> = new Map();
    private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private _manualClosed: boolean = false;
    private _wsCtor: WSCtor | null;

    constructor(url: string, opts?: WsClientOpts) {
        this.url = url;
        this._wsCtor = (opts && opts.wsCtor) || null;
    }

    connect(): void {
        this._manualClosed = false;
        if (typeof wx !== 'undefined' && wx.connectSocket) {
            this._ws = wx.connectSocket({ url: this.url });
            wx.onSocketOpen(() => this._onOpen());
            wx.onSocketMessage((res) => this._onMessage(res.data));
            wx.onSocketError((err) => this._onError(err));
            wx.onSocketClose(() => this._onClose());
            return;
        }
        const Ctor: WSCtor | null = this._wsCtor || (typeof WebSocket !== 'undefined' ? (WebSocket as unknown as WSCtor) : null);
        if (Ctor) {
            this._ws = new Ctor(this.url);
            this._ws.onopen    = () => this._onOpen();
            this._ws.onmessage = (ev: { data: unknown } | unknown) => {
                const data = (ev as { data?: unknown }).data !== undefined ? (ev as { data: unknown }).data : ev;
                this._onMessage(data);
            };
            this._ws.onerror   = (err: unknown) => this._onError(err);
            this._ws.onclose   = () => this._onClose();
        } else {
            Logger.warn('WS', 'no WebSocket impl available');
        }
    }

    isConnected(): boolean { return this._connected; }

    send(type: string, data: unknown): Promise<any> {
        const seq = this._seq++;
        const msg = { type, seq, timestamp: Date.now(), data };
        return new Promise<any>((resolve, reject) => {
            const timer = setTimeout(() => {
                this._pending.delete(seq);
                reject(new Error('send_timeout'));
            }, SEND_TIMEOUT_MS);
            this._pending.set(seq, { resolve, reject, timer });
            this._sendRaw(JSON.stringify(msg));
        });
    }

    sendFireAndForget(type: string, data: unknown): void {
        this._sendRaw(JSON.stringify({ type, timestamp: Date.now(), data }));
    }

    private _sendRaw(text: string): void {
        if (typeof wx !== 'undefined' && wx.sendSocketMessage) {
            wx.sendSocketMessage({ data: text });
        } else if (this._ws && this._connected) {
            this._ws.send(text);
        }
    }

    close(): void {
        this._manualClosed = true;
        if (typeof wx !== 'undefined' && wx.closeSocket) wx.closeSocket();
        else if (this._ws) this._ws.close();
    }

    private _onOpen(): void {
        this._connected = true;
        Logger.info('WS', 'open');
        EventBus.emit('ws_open');
        this._startHeartbeat();
    }

    private _onMessage(text: unknown): void {
        try {
            let s: string;
            if (typeof text === 'string') s = text;
            else if (text && typeof (text as { toString?: () => string }).toString === 'function') s = (text as { toString: (enc?: string) => string }).toString('utf8');
            else s = String(text);
            const msg = JSON.parse(s);
            if (msg.seq && this._pending.has(msg.seq)) {
                const { resolve, timer } = this._pending.get(msg.seq)!;
                clearTimeout(timer);
                this._pending.delete(msg.seq);
                resolve(msg);
                return;
            }
            EventBus.emit('ws_message', msg);
            if (msg.type) EventBus.emit('ws:' + msg.type, msg.data);
        } catch (e) {
            Logger.error('WS', 'bad message', e);
        }
    }

    private _onError(err: unknown): void {
        Logger.error('WS', 'error', err);
        EventBus.emit('ws_error', err);
    }

    private _onClose(): void {
        this._connected = false;
        EventBus.emit('ws_close');
        this._stopHeartbeat();
        if (!this._manualClosed) this._scheduleReconnect();
    }

    private _scheduleReconnect(): void {
        if (this._reconnectTimer) return;
        this._reconnectTimer = setTimeout(() => {
            this._reconnectTimer = null;
            Logger.info('WS', 'reconnecting...');
            this.connect();
        }, RECONNECT_INTERVAL_MS);
    }

    private _startHeartbeat(): void {
        this._stopHeartbeat();
        this._heartbeatTimer = setInterval(() => this.sendFireAndForget('ping', {}), HEARTBEAT_MS);
    }

    private _stopHeartbeat(): void {
        if (this._heartbeatTimer) { clearInterval(this._heartbeatTimer); this._heartbeatTimer = null; }
    }
}
