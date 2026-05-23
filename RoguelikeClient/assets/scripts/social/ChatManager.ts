/**
 * 聊天系统（来自需求文档 §F-1.6）
 * ---------------------------------------------------------------
 * 本地乐观显示 + 服务端广播去重：
 *   - 客户端发送时立即 emit 'chat_message'（乐观）
 *   - 服务端广播回来时若 fromId === 自己，则跳过避免重复
 */

import { instance as EventBus } from '../core/EventBus';
import { MessageType } from '../../shared/index';
import { instance as User } from '../data/UserDataManager';
import type { NetworkClient } from '../network/NetworkClient';

/** 预设快捷消息 */
export const QuickMessages: readonly string[] = Object.freeze([
    '等我准备好了再开',
    '上！冲啊！',
    '放个冰塔这里',
    '该升级了',
    'BOSS 来了做好准备',
    '我的金币不够了',
    '帮我刷下商店',
    '注意水晶安全！',
    '集中火力',
    '666',
    '稳住别浪',
    'GG，下波再来',
    '需要支援',
    '感谢队友',
    '抱歉操作失误',
    '这波很关键',
    '骰子炸了',
    '抽到神卡了！',
    '快赠点金币',
    '拜拜下次见',
]);

const SENSITIVE_WORDS: string[] = [];
export const MAX_MESSAGE_LEN = 50;

export interface SendTextResult { ok: boolean; reason?: string; }

export interface ChatMessage {
    roomId?: string;
    fromId: string;
    text: string;
    quick: boolean;
    quickIdx?: number;
    ts: number;
}

export class ChatManager {
    public client: NetworkClient | null;

    constructor(ctx?: { client?: NetworkClient }) {
        this.client = (ctx && ctx.client) || null;
        // 服务端推送：去重——若 fromId 是自己，跳过（已乐观显示过）
        EventBus.on('ws:' + MessageType.CHAT_MESSAGE, (data: ChatMessage) => {
            if (data && data.fromId && data.fromId === User.data.openid) return;
            this.receive(data);
        });
    }

    bindClient(client: NetworkClient): void { this.client = client; }

    sendQuick(roomId: string, fromId: string, idx: number): void {
        if (idx < 0 || idx >= QuickMessages.length) return;
        const text = QuickMessages[idx];
        this._send(roomId, fromId, text, true, idx);
    }

    sendText(roomId: string, fromId: string, text: string): SendTextResult {
        if (typeof text !== 'string') return { ok: false, reason: 'invalid' };
        const trim = text.trim();
        if (trim.length === 0) return { ok: false, reason: 'empty' };
        if (trim.length > MAX_MESSAGE_LEN) return { ok: false, reason: 'too_long' };
        if (this._hasSensitive(trim)) return { ok: false, reason: 'sensitive' };
        this._send(roomId, fromId, trim, false);
        return { ok: true };
    }

    receive(msg: ChatMessage): void {
        EventBus.emit('chat_message', msg);
    }

    private _send(roomId: string, fromId: string, text: string, quick: boolean, quickIdx?: number): void {
        // 本地乐观显示
        EventBus.emit('chat_message', { roomId, fromId, text, quick, quickIdx, ts: Date.now() });
        if (this.client) {
            const payload = quick ? { quickIdx } : { text };
            this.client.send('chat_message', payload).catch(() => { /* swallow */ });
        }
    }

    private _hasSensitive(text: string): boolean {
        for (const w of SENSITIVE_WORDS) {
            if (w && text.indexOf(w) >= 0) return true;
        }
        return false;
    }
}
