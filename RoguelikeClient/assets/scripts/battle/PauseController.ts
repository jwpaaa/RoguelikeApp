/**
 * 暂停控制器（来自需求文档 §F-2.8）
 * ---------------------------------------------------------------
 * 单机：本地直接处理。
 * 联机：通过 NetworkClient 发 PAUSE_REQUEST / PAUSE_VOTE / PAUSE_RESULT，
 *       服务端转发给同房间所有玩家；本地仅在收到广播时同步状态。
 */

import { instance as TimeManager } from '../core/TimeManager';
import { instance as EventBus } from '../core/EventBus';
import { MessageType } from '../../shared/index';

export const MAX_PAUSE_PER_BATTLE = 3;
export const MAX_PAUSE_DURATION_MS = 60000;

/** NetworkClient 子集（仅声明用到的方法，避免循环依赖） */
export interface PauseNet {
    isOnline(): boolean;
    send(type: string, data: unknown): Promise<unknown>;
    sendFireAndForget(type: string, data: unknown): void;
    openid: string | null;
}

export interface PauseCtx {
    players: string[];
    hostId: string;
    isBossWave: () => boolean;
    /** 联机时传入；单机不传 */
    net?: PauseNet | null;
}

export interface OpResult { ok: boolean; reason?: string; passed?: boolean; }

export type PauseSource = 'host' | 'vote' | 'disconnect' | 'network';

interface VoteState {
    initiator: string;
    agree: Set<string>;
    disagree: Set<string>;
}

export class PauseController {
    public players: string[];
    public hostId: string;
    public isBossWave: () => boolean;
    public net: PauseNet | null;
    public paused: boolean = false;
    public pauseUsed: number = 0;
    public pauseRemainMs: number = 0;
    public pauseSource: PauseSource | null = null;
    public vote: VoteState | null = null;

    constructor(ctx: PauseCtx) {
        this.players = ctx.players;
        this.hostId = ctx.hostId;
        this.isBossWave = ctx.isBossWave;
        this.net = ctx.net || null;
        this._bindServerPush();
    }

    /** 当前玩家 ID（联机时取自 NetworkClient.openid，否则用 hostId） */
    private _myId(): string { return (this.net && this.net.openid) || this.hostId; }
    private _isOnline(): boolean { return !!(this.net && this.net.isOnline()); }

    hostPause(): OpResult {
        if (this.isBossWave && this.isBossWave()) return { ok: false, reason: 'boss_wave' };
        if (this.pauseUsed >= MAX_PAUSE_PER_BATTLE) return { ok: false, reason: 'limit' };

        if (this._isOnline()) {
            // 联机：房主直接广播 PAUSE_RESULT
            this.net!.sendFireAndForget(MessageType.PAUSE_RESULT, {
                paused: true, durationMs: MAX_PAUSE_DURATION_MS, source: 'host',
            });
            // 本地不立即进入暂停，等服务端广播回来由 _onPauseResult 处理
            return { ok: true };
        }
        // 单机：直接进入
        this._enterPause('host');
        return { ok: true };
    }

    /** 系统/断线触发暂停（不计入 3 次额度） */
    systemPause(source: PauseSource, durationMs?: number): OpResult {
        this._enterPause(source || 'disconnect', durationMs || 10000, false);
        return { ok: true };
    }

    requestVote(initiator: string): OpResult {
        if (this.paused) return { ok: false, reason: 'already' };
        if (this.isBossWave && this.isBossWave()) return { ok: false, reason: 'boss_wave' };

        if (this._isOnline()) {
            // 联机：上报 PAUSE_REQUEST，让服务端广播
            this.net!.sendFireAndForget(MessageType.PAUSE_REQUEST, {
                initiator, reason: 'vote',
            });
            // 本地不立即建 vote 状态，等 _onPauseRequest 广播回来才创建
            return { ok: true };
        }
        // 单机：直接建本地投票
        this.vote = { initiator, agree: new Set([initiator]), disagree: new Set() };
        EventBus.emit('pause_vote_started', { initiator });
        return { ok: true };
    }

    /** 玩家投票 */
    vote_(playerId: string, agree: boolean): OpResult {
        if (!this.vote) return { ok: false, reason: 'no_vote' };

        if (this._isOnline()) {
            // 联机：上报 PAUSE_VOTE，由服务端广播给所有人
            this.net!.sendFireAndForget(MessageType.PAUSE_VOTE, {
                voter: playerId, agree: !!agree,
            });
            // 仅由 _onPauseVote 接收广播后再统计（避免本地先于服务端广播抢跑）
            return { ok: true };
        }
        // 单机：本地立即统计
        return this._tallyVote(playerId, agree);
    }

    /** 单机统计投票（联机时由广播触发） */
    private _tallyVote(playerId: string, agree: boolean): OpResult {
        if (!this.vote) return { ok: false, reason: 'no_vote' };
        if (agree) {
            this.vote.agree.add(playerId);
            this.vote.disagree.delete(playerId);
        } else {
            this.vote.disagree.add(playerId);
            this.vote.agree.delete(playerId);
        }
        let agreeCnt    = this.vote.agree.size;
        let disagreeCnt = this.vote.disagree.size;
        if (this.vote.agree.has(this.hostId))    agreeCnt    += 1;
        if (this.vote.disagree.has(this.hostId)) disagreeCnt += 1;
        const total = this.players.length + 1; // 房主算双倍
        if (agreeCnt > total / 2) {
            // 单机模式直接 enter；联机模式只有房主真正广播 PAUSE_RESULT
            if (!this._isOnline()) this._enterPause('vote');
            else if (this._myId() === this.hostId) {
                this.net!.sendFireAndForget(MessageType.PAUSE_RESULT, {
                    paused: true, durationMs: MAX_PAUSE_DURATION_MS, source: 'vote',
                });
            }
            this.vote = null;
            return { ok: true, passed: true };
        }
        if (disagreeCnt >= total / 2) {
            this.vote = null;
            EventBus.emit('pause_vote_failed');
            return { ok: true, passed: false };
        }
        return { ok: true };
    }

    resume(): void {
        if (!this.paused) return;
        if (this._isOnline() && this._myId() === this.hostId) {
            this.net!.sendFireAndForget(MessageType.PAUSE_RESULT, { paused: false });
        }
        this._doResume();
    }

    private _doResume(): void {
        this.paused = false;
        this.pauseSource = null;
        this.pauseRemainMs = 0;
        TimeManager.resume();
        EventBus.emit('pause_resume');
    }

    realTimeTick(dtMs: number): void {
        if (!this.paused) return;
        this.pauseRemainMs -= dtMs;
        if (this.pauseRemainMs <= 0) this.resume();
    }

    private _enterPause(source: PauseSource, durationMs?: number, countLimit?: boolean): void {
        this.paused = true;
        this.pauseSource = source;
        this.pauseRemainMs = durationMs || MAX_PAUSE_DURATION_MS;
        if (countLimit !== false) this.pauseUsed++;
        TimeManager.pause();
        EventBus.emit('pause_enter', { source, remainMs: this.pauseRemainMs });
    }

    /** 联机：订阅服务端推送 */
    private _bindServerPush(): void {
        EventBus.on('ws:' + MessageType.PAUSE_REQUEST, (data: { initiator: string; isHost: boolean }) => {
            if (data.isHost) return; // 房主直接走 PAUSE_RESULT，不需要建 vote
            this.vote = { initiator: data.initiator, agree: new Set([data.initiator]), disagree: new Set() };
            EventBus.emit('pause_vote_started', { initiator: data.initiator });
        });
        EventBus.on('ws:' + MessageType.PAUSE_VOTE, (data: { voter: string; agree: boolean }) => {
            this._tallyVote(data.voter, data.agree);
        });
        EventBus.on('ws:' + MessageType.PAUSE_RESULT, (data: { paused: boolean; durationMs?: number; source?: PauseSource }) => {
            if (data.paused) {
                this._enterPause(data.source || 'host', data.durationMs);
            } else {
                this._doResume();
            }
        });
    }
}
