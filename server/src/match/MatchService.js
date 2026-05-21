/**
 * 快速匹配（来自需求文档 §F-1.4）
 * ---------------------------------------------------------------
 * 简化的"按难度分桶"匹配：
 *   - 每个难度一个等待队列
 *   - 凑齐 2-4 人立刻开房（默认 4 人 → 不够 15s 后允许 2-3 人开）
 *   - 玩家若选"允许 AI"，15s 仍不足 → 用 AI 补满
 *
 * 服务端不真正"跑"AI；AI 队友只是房间内挂个 isAi=true 的位置，
 * 实际行为由房主客户端的 AutoTowerAI 接管（确定性、无延迟）。
 */

'use strict';

const { Logger } = require('../util/Logger');

const QUEUE_GROUP_SIZE = 4;
const FLEX_TIMEOUT_MS = 15 * 1000;

class MatchService {
    /** @param {{ roomManager:import('../room/RoomManager').RoomManager }} ctx */
    constructor(ctx) {
        this.roomManager = ctx.roomManager;
        /** Map<difficulty, Array<{ openid, name, connId, joinedAt, allowAi }>> */
        this.queues = new Map();
        this._sweepTimer = setInterval(() => this._sweep(), 1000);
    }

    /**
     * @param {{ openid:string, name:string, connId:string, difficulty:number, allowAi:boolean, forceAi?:boolean }} p
     */
    enqueue(p) {
        const diff = p.difficulty || 2;
        if (!this.queues.has(diff)) this.queues.set(diff, []);
        const q = this.queues.get(diff);
        // 防止重复入队
        if (q.find((x) => x.openid === p.openid)) return { ok: false, reason: 'already' };
        q.push(Object.assign({}, p, { joinedAt: Date.now() }));
        Logger.info('Match', 'enqueue', p.openid, 'diff', diff, 'queueLen', q.length);

        // 立即尝试凑足 4 人
        if (q.length >= QUEUE_GROUP_SIZE) {
            this._formGroup(diff, QUEUE_GROUP_SIZE);
        }

        // forceAi → 立刻补 AI 开房
        if (p.forceAi) {
            this._formGroupWithAi(diff, p);
        }
        return { ok: true };
    }

    cancel(openid) {
        for (const [diff, q] of this.queues) {
            const idx = q.findIndex((x) => x.openid === openid);
            if (idx >= 0) {
                q.splice(idx, 1);
                Logger.info('Match', 'cancel', openid, 'diff', diff);
                return true;
            }
        }
        return false;
    }

    stop() { clearInterval(this._sweepTimer); }

    /** 每秒检查：超过 15s 的"允许 AI"玩家补 AI */
    _sweep() {
        for (const [diff, q] of this.queues) {
            // 凑足 2/3 人也开（弹性）
            if (q.length >= 2) {
                const oldest = q[0];
                if (Date.now() - oldest.joinedAt > FLEX_TIMEOUT_MS) {
                    this._formGroup(diff, q.length);
                }
            }
            // 单人 + 允许 AI > 15s → AI 填充
            for (let i = q.length - 1; i >= 0; i--) {
                const p = q[i];
                if (p.allowAi && Date.now() - p.joinedAt > FLEX_TIMEOUT_MS) {
                    q.splice(i, 1);
                    this._formGroupWithAi(diff, p);
                }
            }
        }
    }

    _formGroup(diff, take) {
        const q = this.queues.get(diff) || [];
        if (q.length < 2) return;
        const players = q.splice(0, Math.min(take, q.length));
        const host = players[0];
        const r = this.roomManager.createRoom({
            openid: host.openid, name: host.name,
            difficulty: diff, maxPlayers: Math.max(players.length, 2),
            connId: host.connId,
        });
        if (r.error || !r.room) {
            Logger.error('Match', 'create room failed', r);
            return;
        }
        // 其他人加入
        for (let i = 1; i < players.length; i++) {
            const p = players[i];
            this.roomManager.joinRoom({ openid: p.openid, name: p.name, roomId: r.room.roomId, connId: p.connId });
        }
        Logger.info('Match', 'formed', r.room.roomId, 'players', players.length);
        // 通知每个人
        for (const p of players) {
            const conn = this._getConn(p.connId);
            if (conn) conn.send({
                type: 'match_rsp',
                timestamp: Date.now(),
                data: { success: true, room: r.room.toJSON() },
            });
        }
    }

    _formGroupWithAi(diff, p) {
        const r = this.roomManager.createRoom({
            openid: p.openid, name: p.name, difficulty: diff,
            maxPlayers: 2, connId: p.connId,
        });
        if (r.error || !r.room) return;
        r.room.addPlayer({
            openid: 'ai_' + r.room.roomId,
            name: 'AI 队友', ready: true, host: false, online: true, isAi: true,
        });
        Logger.info('Match', 'AI filled', r.room.roomId);
        const conn = this._getConn(p.connId);
        if (conn) conn.send({
            type: 'match_rsp',
            timestamp: Date.now(),
            data: { success: true, withAi: true, room: r.room.toJSON() },
        });
    }

    _getConn(connId) {
        return this.roomManager.ws.connections.get(connId);
    }
}

module.exports = { MatchService };
