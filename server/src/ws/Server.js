/**
 * WebSocket 服务器（兼容 uWS / ws 两种实现）
 * ---------------------------------------------------------------
 * 默认走 ws（纯 JS），生产可通过 WS_IMPL=uws 切换 uWebSockets.js。
 *
 * 对外提供：
 *   - start() 启动监听
 *   - onConnect(fn)、onMessage(fn)、onClose(fn) 回调
 *   - 连接列表：connections (Map<id, Connection>)
 */

'use strict';

const { config } = require('../config');
const { Logger } = require('../util/Logger');
const { Connection } = require('./Connection');

class WsServer {
    constructor() {
        /** @type {Map<string, Connection>} */
        this.connections = new Map();
        /** @type {(conn:Connection)=>void|null} */
        this._onConnect = null;
        /** @type {(conn:Connection, msg:any)=>void|null} */
        this._onMessage = null;
        /** @type {(conn:Connection)=>void|null} */
        this._onClose = null;
        this._heartbeatTimer = null;
    }

    onConnect(fn) { this._onConnect = fn; }
    onMessage(fn) { this._onMessage = fn; }
    onClose(fn)   { this._onClose = fn; }

    /** 广播给一组连接 */
    broadcast(connIds, msg) {
        for (const id of connIds) {
            const c = this.connections.get(id);
            if (c && c.alive) c.send(msg);
        }
    }

    /** 启动服务 */
    async start() {
        if (config.wsImpl === 'uws') {
            await this._startUws();
        } else {
            await this._startWs();
        }
        // 心跳检查 30s 一次
        this._heartbeatTimer = setInterval(() => this._sweepHeartbeat(), 30 * 1000);
        Logger.info('WS', 'started on port', config.port, 'impl=', config.wsImpl);
    }

    async stop() {
        if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
        for (const c of this.connections.values()) c.close(1001, 'shutdown');
        this.connections.clear();
    }

    _sweepHeartbeat() {
        const dead = [];
        for (const c of this.connections.values()) {
            if (c.isTimedOut()) dead.push(c);
        }
        for (const c of dead) {
            Logger.warn('WS', 'heartbeat timeout', c.id);
            c.close(4000, 'heartbeat_timeout');
        }
    }

    // -------------------- ws 实现 --------------------
    async _startWs() {
        let WebSocketServer;
        try { ({ WebSocketServer } = require('ws')); }
        catch (e) {
            Logger.error('WS', 'ws not installed, please `npm install`');
            throw e;
        }
        const wss = new WebSocketServer({ port: config.port });
        wss.on('connection', (ws) => this._handleNewSocket(ws, 'ws'));
        wss.on('error', (e) => Logger.error('WS', 'server error', e));
        this._wss = wss;
    }

    _handleNewSocket(ws, kind) {
        const sendFn = (text) => ws.send(text);
        const closeFn = (code, reason) => { try { ws.close(code || 1000, reason || ''); } catch (_e) {} };
        const conn = new Connection(sendFn, closeFn);
        this.connections.set(conn.id, conn);
        Logger.debug('WS', 'connect', conn.id);
        if (this._onConnect) this._onConnect(conn);

        ws.on('message', (data) => {
            conn.touch();
            const text = (typeof data === 'string') ? data : data.toString('utf8');
            let msg;
            try { msg = JSON.parse(text); }
            catch (_e) { Logger.warn('WS', 'bad json', conn.id); return; }
            if (this._onMessage) this._onMessage(conn, msg);
        });
        ws.on('close', () => {
            conn.alive = false;
            this.connections.delete(conn.id);
            if (this._onClose) this._onClose(conn);
            Logger.debug('WS', 'close', conn.id);
        });
        ws.on('error', (e) => Logger.warn('WS', 'socket error', conn.id, e.message));
    }

    // -------------------- uWS 实现 --------------------
    async _startUws() {
        let uWS;
        try { uWS = require('uWebSockets.js'); }
        catch (_e) {
            Logger.warn('WS', 'uWebSockets.js not available, falling back to ws');
            return this._startWs();
        }
        const app = uWS.App();
        app.ws('/*', {
            compression: 1,
            maxPayloadLength: 64 * 1024,
            idleTimeout: 0,
            open: (ws) => {
                const sendFn  = (text) => ws.send(text, false);
                const closeFn = () => ws.close();
                const conn = new Connection(sendFn, closeFn);
                ws.conn = conn;
                this.connections.set(conn.id, conn);
                if (this._onConnect) this._onConnect(conn);
            },
            message: (ws, msg, _isBinary) => {
                const conn = ws.conn;
                conn.touch();
                const text = Buffer.from(msg).toString('utf8');
                let parsed;
                try { parsed = JSON.parse(text); }
                catch (_e) { return; }
                if (this._onMessage) this._onMessage(conn, parsed);
            },
            close: (ws) => {
                const conn = ws.conn;
                if (!conn) return;
                conn.alive = false;
                this.connections.delete(conn.id);
                if (this._onClose) this._onClose(conn);
            },
        });
        app.listen(config.port, (token) => {
            if (!token) throw new Error('uWS listen failed on ' + config.port);
        });
        this._uws = app;
    }
}

module.exports = { WsServer };
