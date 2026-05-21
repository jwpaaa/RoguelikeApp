/**
 * 聊天服务（来自需求文档 §F-1.6）
 * ---------------------------------------------------------------
 * - 长度限制：50 字
 * - 内容审核：调用 wx.security.msgSecCheck（生产）/ 本地词库（开发）
 * - 频率限制：单玩家 3 秒最多 5 条
 * - 仅同房间内广播（含观战）
 */

'use strict';

const { Logger } = require('../util/Logger');
const { RateLimiter } = require('../util/Helpers');
const { MessageType, ErrorCode } = require('../shared/MessageTypes');
const { checkText } = require('../util/WxContentSec');

const MAX_LEN = 50;
const RATE_WINDOW_MS = 3000;
const RATE_MAX = 5;

class ChatService {
    /** @param {{ roomManager:import('../room/RoomManager').RoomManager }} ctx */
    constructor(ctx) {
        this.roomManager = ctx.roomManager;
        this.limiter = new RateLimiter(RATE_WINDOW_MS, RATE_MAX);
    }

    /**
     * @param {{ openid:string, text?:string, quickIdx?:number }} p
     * @returns {Promise<{ ok?:boolean, error?:string, message?:string }>}
     */
    async send(p) {
        if (!this.limiter.take(p.openid)) {
            return { error: ErrorCode.LIMIT, message: 'chat too fast' };
        }
        const room = this.roomManager.roomOf(p.openid);
        if (!room) return { error: ErrorCode.NOT_FOUND };

        // 快捷消息：跳过内容审核（来自固定列表 0-19）
        if (typeof p.quickIdx === 'number') {
            const msg = {
                type: MessageType.CHAT_MESSAGE,
                timestamp: Date.now(),
                data: { roomId: room.roomId, fromId: p.openid, text: '', quick: true, quickIdx: p.quickIdx },
            };
            // sendToRoom 内部已含观战延迟队列下发
            this.roomManager.sendToRoom(room, msg);
            return { ok: true };
        }

        let text = p.text || '';
        if (typeof text !== 'string') return { error: ErrorCode.BAD_PAYLOAD };
        text = text.trim();
        if (text.length === 0) return { error: ErrorCode.BAD_PAYLOAD };
        if (text.length > MAX_LEN) text = text.slice(0, MAX_LEN);

        // 内容审核
        const sec = await checkText(text, p.openid);
        if (!sec.pass) {
            Logger.info('Chat', 'blocked', p.openid, sec.reason, text);
            return { error: ErrorCode.FORBIDDEN, message: 'sensitive: ' + (sec.reason || '') };
        }

        const msg = {
            type: MessageType.CHAT_MESSAGE,
            timestamp: Date.now(),
            data: { roomId: room.roomId, fromId: p.openid, text, quick: false },
        };
        // sendToRoom 内部已含观战延迟队列下发
        this.roomManager.sendToRoom(room, msg);
        Logger.debug('Chat', room.roomId, p.openid, text);
        return { ok: true };
    }
}

module.exports = { ChatService };
