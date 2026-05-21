/**
 * 房间数据结构（来自需求文档 §F-1.3）
 * ---------------------------------------------------------------
 * 一个 Room 实例对应一场对局的"游说阶段 + 战斗阶段"全过程。
 *
 * 状态机：
 *   WAITING → READY → IN_BATTLE → FINISHED
 *
 * 玩家列表：
 *   { openid, name, avatar, ready, host, online }
 */

'use strict';

const RoomState = Object.freeze({
    WAITING:  'WAITING',
    READY:    'READY',
    IN_BATTLE: 'IN_BATTLE',
    FINISHED: 'FINISHED',
});

class Room {
    /**
     * @param {{ roomId:string, hostOpenid:string, difficulty:number, maxPlayers:number, seed:number }} init
     */
    constructor(init) {
        this.roomId = init.roomId;
        this.hostOpenid = init.hostOpenid;
        this.difficulty = init.difficulty;
        this.maxPlayers = init.maxPlayers;
        this.seed = init.seed;
        this.state = RoomState.WAITING;
        /** @type {Array<{ openid:string, name:string, avatar?:string, ready:boolean, host:boolean, online:boolean, isAi?:boolean }>} */
        this.players = [];
        /** @type {Set<string>} 当前订阅 frame_broadcast 的 connection.id 集合 */
        this.connIds = new Set();
        /** @type {Map<string, string>} openid → connId */
        this.openidToConn = new Map();
        /** 观战者 conn.id 集合 */
        this.spectators = new Set();
        this.createdAt = Date.now();
        this.startedAt = 0;
        this.endedAt = 0;
        /** 服务端权威的战斗状态（由 BattleService 注入） */
        this.battle = null;
    }

    addPlayer(p) {
        if (this.players.find((x) => x.openid === p.openid)) return false;
        if (this.players.length >= this.maxPlayers) return false;
        this.players.push(p);
        return true;
    }

    removePlayer(openid) {
        const idx = this.players.findIndex((x) => x.openid === openid);
        if (idx < 0) return false;
        this.players.splice(idx, 1);
        this.openidToConn.delete(openid);
        return true;
    }

    setReady(openid, ready) {
        const p = this.players.find((x) => x.openid === openid);
        if (!p) return false;
        p.ready = !!ready;
        if (this.players.length >= 2 && this.players.every((x) => x.ready)) this.state = RoomState.READY;
        else if (this.state === RoomState.READY) this.state = RoomState.WAITING;
        return true;
    }

    bindConnection(openid, connId) {
        this.openidToConn.set(openid, connId);
        this.connIds.add(connId);
        const p = this.players.find((x) => x.openid === openid);
        if (p) p.online = true;
    }

    unbindConnection(openid) {
        const connId = this.openidToConn.get(openid);
        if (connId) this.connIds.delete(connId);
        this.openidToConn.delete(openid);
        const p = this.players.find((x) => x.openid === openid);
        if (p) p.online = false;
    }

    /** 简化的 DTO（推送给客户端的) */
    toJSON() {
        return {
            roomId: this.roomId,
            hostId: this.hostOpenid,
            difficulty: this.difficulty,
            maxPlayers: this.maxPlayers,
            seed: this.seed,
            state: this.state,
            players: this.players.map((p) => ({
                id: p.openid, name: p.name, avatar: p.avatar,
                ready: p.ready, host: p.host, online: p.online, isAi: !!p.isAi,
            })),
            createdAt: this.createdAt,
            startedAt: this.startedAt,
        };
    }
}

module.exports = { Room, RoomState };
