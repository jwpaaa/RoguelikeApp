/**
 * 房间管理器（来自需求文档 §F-1.3 + §F-4.6）
 * ---------------------------------------------------------------
 * 负责：
 *   - createRoom / joinRoom / leaveRoom / kick
 *   - 房主转移（房主断线 > 10s 自动转移）
 *   - 房间到 conn 的映射、广播工具
 *   - 房间数上限熔断
 *
 * 房间生命周期：
 *   WAITING → READY → IN_BATTLE → FINISHED → 自动销毁
 *
 * 与 BattleService 配合：开始战斗时 BattleService 接管 tick；
 * 战斗结束时通知本类 onBattleEnd 进行收尾。
 */

'use strict';

const { Room, RoomState } = require('./Room');
const { SpectatorDelayQueue } = require('./SpectatorDelayQueue');
const { Logger } = require('../util/Logger');
const { config } = require('../config');
const { newRoomCode, newSeed } = require('../util/Helpers');
const { MessageType, ErrorCode } = require('../shared/MessageTypes');

const HOST_TRANSFER_GRACE_MS = 10 * 1000;

class RoomManager {
    /** @param {{ wsServer:any }} ctx */
    constructor(ctx) {
        this.ws = ctx.wsServer;
        /** @type {Map<string, Room>} roomId → Room */
        this.rooms = new Map();
        /** @type {Map<string, string>} openid → roomId */
        this.openidToRoom = new Map();
        /** @type {Map<string, NodeJS.Timeout>} 房主离线宽限计时器 */
        this._hostTransferTimers = new Map();
        /** 观战延迟队列 */
        this.specQueue = new SpectatorDelayQueue({ wsServer: this.ws });
    }

    // ---------------- API ----------------

    /**
     * @param {{ openid:string, name:string, difficulty:number, maxPlayers:number, connId:string }} p
     */
    createRoom(p) {
        if (this.rooms.size >= config.maxRooms) return { error: ErrorCode.BUSY, message: 'server full' };
        if (this.openidToRoom.has(p.openid)) return { error: ErrorCode.DUPLICATE, message: 'already in room' };
        const roomId = this._uniqueRoomId();
        const room = new Room({
            roomId,
            hostOpenid: p.openid,
            difficulty: p.difficulty || 2,
            maxPlayers: Math.min(p.maxPlayers || 4, config.maxPlayersPerRoom),
            seed: newSeed(),
        });
        room.addPlayer({ openid: p.openid, name: p.name, avatar: p.avatar, ready: false, host: true, online: true });
        room.bindConnection(p.openid, p.connId);
        this.rooms.set(roomId, room);
        this.openidToRoom.set(p.openid, roomId);
        Logger.info('Room', 'created', roomId, 'by', p.openid);
        return { room };
    }

    /**
     * @param {{ openid:string, name:string, roomId:string, connId:string }} p
     */
    joinRoom(p) {
        const room = this.rooms.get(p.roomId);
        if (!room) return { error: ErrorCode.NOT_FOUND, message: 'no such room' };
        if (room.state === RoomState.IN_BATTLE || room.state === RoomState.FINISHED) {
            return { error: ErrorCode.FORBIDDEN, message: 'room not joinable' };
        }
        if (this.openidToRoom.has(p.openid)) {
            // 已在某房间 → 自动 leave
            this.leaveRoom(p.openid);
        }
        const ok = room.addPlayer({ openid: p.openid, name: p.name, avatar: p.avatar, ready: false, host: false, online: true });
        if (!ok) return { error: ErrorCode.LIMIT, message: 'room full' };
        room.bindConnection(p.openid, p.connId);
        this.openidToRoom.set(p.openid, p.roomId);
        Logger.info('Room', 'join', p.roomId, p.openid);
        this.broadcastRoom(room);
        return { room };
    }

    leaveRoom(openid) {
        const roomId = this.openidToRoom.get(openid);
        if (!roomId) return { error: ErrorCode.NOT_FOUND };
        const room = this.rooms.get(roomId);
        if (!room) {
            this.openidToRoom.delete(openid);
            return {};
        }
        const wasHost = (room.hostOpenid === openid);
        room.removePlayer(openid);
        this.openidToRoom.delete(openid);

        if (room.players.length === 0) {
            this._destroyRoom(roomId);
            return {};
        }

        // 房主转移：在战斗外立即转，战斗中等宽限期
        if (wasHost) {
            if (room.state === RoomState.IN_BATTLE) {
                this._scheduleHostTransfer(room);
            } else {
                this._transferHost(room);
            }
        }
        this.broadcastRoom(room);
        return { room };
    }

    /**
     * 由 RoomService 在玩家断线时调用：仅标记 offline，不立刻 remove
     * @param {string} openid
     */
    markOffline(openid) {
        const roomId = this.openidToRoom.get(openid);
        const room = roomId && this.rooms.get(roomId);
        if (!room) return;
        room.unbindConnection(openid);
        if (room.hostOpenid === openid && room.state === RoomState.IN_BATTLE) {
            this._scheduleHostTransfer(room);
        }
        this.broadcastRoom(room);
    }

    /** 同 openid 重连 → 重新绑定连接 */
    rebindConnection(openid, connId) {
        const roomId = this.openidToRoom.get(openid);
        const room = roomId && this.rooms.get(roomId);
        if (!room) return null;
        room.bindConnection(openid, connId);
        if (this._hostTransferTimers.has(room.roomId) && room.hostOpenid === openid) {
            clearTimeout(this._hostTransferTimers.get(room.roomId));
            this._hostTransferTimers.delete(room.roomId);
        }
        this.broadcastRoom(room);
        return room;
    }

    /** 房主踢人 */
    kick(operatorOpenid, targetOpenid) {
        const room = this._roomOf(operatorOpenid);
        if (!room) return { error: ErrorCode.NOT_FOUND };
        if (room.hostOpenid !== operatorOpenid) return { error: ErrorCode.FORBIDDEN };
        if (operatorOpenid === targetOpenid) return { error: ErrorCode.BAD_PAYLOAD };
        return this.leaveRoom(targetOpenid);
    }

    setReady(openid, ready) {
        const room = this._roomOf(openid);
        if (!room) return { error: ErrorCode.NOT_FOUND };
        room.setReady(openid, ready);
        this.broadcastRoom(room);
        return { room };
    }

    /** 找到当前是哪个房间 */
    roomOf(openid) { return this._roomOf(openid); }

    // ---------------- 内部 ----------------

    _roomOf(openid) {
        const rid = this.openidToRoom.get(openid);
        return rid ? this.rooms.get(rid) : null;
    }

    _uniqueRoomId() {
        for (let i = 0; i < 8; i++) {
            const id = newRoomCode();
            if (!this.rooms.has(id)) return id;
        }
        // fallback
        return 'r' + Date.now().toString(36);
    }

    _destroyRoom(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return;
        if (room.battle && room.battle.dispose) room.battle.dispose();
        if (this._hostTransferTimers.has(roomId)) {
            clearTimeout(this._hostTransferTimers.get(roomId));
            this._hostTransferTimers.delete(roomId);
        }
        // 通知所有连接（含观战）
        this.broadcastRoom(room, { destroyed: true });
        this.specQueue.clearRoom(roomId);
        this.rooms.delete(roomId);
        Logger.info('Room', 'destroyed', roomId);
    }

    _scheduleHostTransfer(room) {
        if (this._hostTransferTimers.has(room.roomId)) return;
        const timer = setTimeout(() => {
            this._hostTransferTimers.delete(room.roomId);
            // 仍是同一个房主且仍然离线 → 转移
            const host = room.players.find((p) => p.openid === room.hostOpenid);
            if (host && !host.online) this._transferHost(room);
        }, HOST_TRANSFER_GRACE_MS);
        this._hostTransferTimers.set(room.roomId, timer);
    }

    _transferHost(room) {
        const next = room.players.find((p) => p.online && p.openid !== room.hostOpenid)
                  || room.players.find((p) => p.openid !== room.hostOpenid);
        if (!next) {
            // 全部离线 → 销毁
            this._destroyRoom(room.roomId);
            return;
        }
        room.players.forEach((p) => { p.host = (p.openid === next.openid); });
        room.hostOpenid = next.openid;
        Logger.info('Room', 'host transferred', room.roomId, '→', next.openid);
        this.broadcastRoom(room, { hostTransfer: true });
    }

    // ---------------- 广播 ----------------

    /** 给房间所有在线玩家（含观战）发 room_update */
    broadcastRoom(room, extra) {
        const payload = {
            type: MessageType.ROOM_UPDATE,
            timestamp: Date.now(),
            data: Object.assign({ room: room.toJSON() }, extra || {}),
        };
        this.ws.broadcast(Array.from(room.connIds), payload);
        if (room.spectators.size > 0) this.ws.broadcast(Array.from(room.spectators), payload);
    }

    /** 给房间所有玩家发自定义消息（含观战者，但观战者走延迟队列） */
    sendToRoom(room, msg) {
        this.ws.broadcast(Array.from(room.connIds), msg);
        // 观战者：入延迟队列（默认 20s 后才下发）
        if (room.spectators.size > 0) {
            this.specQueue.enqueue(room.roomId, Array.from(room.spectators), msg);
        }
    }
}

module.exports = { RoomManager, HOST_TRANSFER_GRACE_MS };
