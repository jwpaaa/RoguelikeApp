/**
 * 消息路由器
 * ---------------------------------------------------------------
 * 把"type → handler"绑定起来，业务模块通过 register(type, fn) 注册。
 * 自动处理：
 *   - JSON 解析后的 msg 校验
 *   - 异常捕获，统一回 error 包
 *   - seq 透传到响应
 *
 * 中间件式 require auth：handler 上挂 `.requireAuth = true` 即可。
 */

'use strict';

const { Logger } = require('../util/Logger');
const { MessageType, ErrorCode } = require('../shared/MessageTypes');

class Router {
    constructor() {
        /** @type {Map<string, Function>} */
        this.handlers = new Map();
    }

    /**
     * @param {string} type
     * @param {(ctx:{conn:any, msg:object, data:any})=>Promise<object|void>|object|void} handler
     * @param {{ requireAuth?:boolean }} [opts]
     */
    register(type, handler, opts) {
        if (opts && opts.requireAuth) handler.requireAuth = true;
        this.handlers.set(type, handler);
    }

    /** WsServer.onMessage 调用 */
    async dispatch(conn, msg) {
        if (!msg || typeof msg.type !== 'string') {
            return this._sendError(conn, msg, ErrorCode.BAD_PAYLOAD, 'no type');
        }
        const handler = this.handlers.get(msg.type);
        if (!handler) {
            // 仅 pong 等心跳允许沉默
            if (msg.type === MessageType.PONG) return;
            return this._sendError(conn, msg, ErrorCode.NOT_FOUND, 'unknown type: ' + msg.type);
        }
        if (handler.requireAuth && !conn.openid) {
            return this._sendError(conn, msg, ErrorCode.UNAUTHORIZED, 'login required');
        }
        try {
            const rsp = await handler({ conn, msg, data: msg.data || {} });
            if (rsp !== undefined) {
                // 三种返回形态：
                //   1) { type, ... }                完整自定义包
                //   2) { data: ... }                普通响应（最常见）
                //   3) 其他                          自动包成 { data: ... }
                let envelope;
                if (rsp && rsp.type) envelope = rsp;
                else if (rsp && Object.prototype.hasOwnProperty.call(rsp, 'data')) envelope = rsp;
                else envelope = { data: rsp };
                conn.send(Object.assign({ type: msg.type + '_rsp', seq: msg.seq, timestamp: Date.now() }, envelope));
            }
        } catch (e) {
            Logger.error('Router', msg.type, e.stack || e.message);
            this._sendError(conn, msg, ErrorCode.INTERNAL, e.message || 'internal');
        }
    }

    _sendError(conn, msg, code, message) {
        conn.send({
            type: MessageType.ERROR,
            seq: msg && msg.seq,
            timestamp: Date.now(),
            data: { code, message, refType: msg && msg.type },
        });
    }
}

module.exports = { Router };
