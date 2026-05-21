/**
 * 观战延迟队列（来自需求文档 §F-4.7）
 * ---------------------------------------------------------------
 * - 玩家加入观战 → 创建延迟队列
 * - 房间内任何 frame_broadcast / dice_result / gacha_result / chat_message
 *   等推给玩家的消息，同步入队，延迟 N 秒后才发给观战者
 * - 观战者退出 → 销毁队列
 *
 * 与 RoomManager.sendToRoom 配合：sendToRoom 内部调用 this.specQueue.enqueue()
 */

'use strict';

const { Logger } = require('../util/Logger');

const DEFAULT_DELAY_SEC = 20;
const FLUSH_INTERVAL_MS = 200;
const MAX_QUEUE_SIZE = 5000;

class SpectatorDelayQueue {
    /**
     * @param {object} ctx
     * @param {import('../ws/Server').WsServer} ctx.wsServer
     * @param {number} [ctx.delaySec=20]
     */
    constructor(ctx) {
        this.ws = ctx.wsServer;
        this.delaySec = ctx.delaySec || DEFAULT_DELAY_SEC;
        /** @type {Map<string, Array<{ enqueueTs:number, connIds:string[], msg:object }>>} roomId → queue */
        this.queues = new Map();
        this._timer = setInterval(() => this._flushAll(), FLUSH_INTERVAL_MS);
    }

    setDelay(sec) { this.delaySec = sec; }

    /**
     * 入队一条要延迟下发给观战者的消息
     * @param {string} roomId
     * @param {string[]} connIds 当前观战者连接 ID 列表
     * @param {object} msg
     */
    enqueue(roomId, connIds, msg) {
        if (!connIds || connIds.length === 0) return;
        let q = this.queues.get(roomId);
        if (!q) { q = []; this.queues.set(roomId, q); }
        if (q.length >= MAX_QUEUE_SIZE) {
            Logger.warn('SpecQ', 'queue overflow', roomId);
            q.shift();
        }
        q.push({ enqueueTs: Date.now(), connIds: connIds.slice(), msg });
    }

    /** 清理某房间的队列（房间销毁时调用） */
    clearRoom(roomId) { this.queues.delete(roomId); }

    /** 立即冲刷所有到期的消息 */
    _flushAll() {
        const cutoff = Date.now() - this.delaySec * 1000;
        for (const [roomId, q] of this.queues) {
            while (q.length > 0 && q[0].enqueueTs <= cutoff) {
                const item = q.shift();
                this.ws.broadcast(item.connIds, item.msg);
            }
            if (q.length === 0) this.queues.delete(roomId);
        }
    }

    stop() {
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
        this.queues.clear();
    }
}

module.exports = { SpectatorDelayQueue, DEFAULT_DELAY_SEC };
