/**
 * 单个 WebSocket 连接的包装
 * ---------------------------------------------------------------
 * 屏蔽 uWS / ws 两套底层接口差异，提供：
 *   - send(msg)
 *   - close(reason)
 *   - 心跳监控（最后活跃时间）
 *   - 玩家上下文（openid / roomId / token）
 *
 * 上层 Router 与 RoomManager 都基于本类，无须知晓底层实现。
 */

'use strict';

const { Logger } = require('../util/Logger');

const HEARTBEAT_TIMEOUT_MS = 60 * 1000;

let _seq = 1;

class Connection {
    /**
     * @param {object} sendFn 发送函数：(text) => void
     * @param {object} closeFn 关闭函数：(reason?) => void
     */
    constructor(sendFn, closeFn) {
        this.id = 'conn_' + (_seq++);
        this._send = sendFn;
        this._close = closeFn;
        this.openid = null;
        this.roomId = null;
        this.token = null;
        this.lastActiveTs = Date.now();
        this.alive = true;
    }

    /** 发送消息（自动 JSON 序列化） */
    send(msg) {
        if (!this.alive) return;
        let text;
        try { text = typeof msg === 'string' ? msg : JSON.stringify(msg); }
        catch (e) { Logger.error('Conn', 'serialize fail', e); return; }
        try { this._send(text); }
        catch (e) { Logger.warn('Conn', 'send fail', this.id, e.message); }
    }

    /** 主动关闭 */
    close(code, reason) {
        this.alive = false;
        try { this._close(code, reason); } catch (_e) {}
    }

    /** 接收时调用：更新活跃时间 */
    touch() { this.lastActiveTs = Date.now(); }

    /** 心跳超时检查 */
    isTimedOut() { return Date.now() - this.lastActiveTs > HEARTBEAT_TIMEOUT_MS; }
}

module.exports = { Connection, HEARTBEAT_TIMEOUT_MS };
