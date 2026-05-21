/**
 * 协作机制（来自需求文档 §F-4.5）
 */

import { instance as EventBus } from '../core/EventBus';
import type { EconomyManager } from '../battle/EconomyManager';

export const REQUEST_COOLDOWN_MS = 30000;
export const PIN_DURATION_MS = 3000;
export const GIFT_REVOKE_WINDOW_MS = 5000;

export interface CoopCtx { economy: EconomyManager; }

export interface RequestResult { ok: boolean; reason?: string; remainMs?: number; }
export interface GiftResult    { ok: boolean; reason?: string; received?: number; }

interface PendingGift {
    fromId: string;
    toId: string;
    amount: number;
    ts: number;
}

export interface MapPin {
    playerId: string;
    x: number;
    y: number;
    kind: string;
    ts: number;
    durationMs: number;
}

export interface BuildRequest {
    fromId: string;
    toId: string;
    towerType: string;
    x: number;
    y: number;
    ts: number;
}

export class CooperationManager {
    public economy: EconomyManager;
    public lastRequestTs: Map<string, number> = new Map();
    public blocks: Map<string, Set<string>> = new Map();
    public pendingGifts: PendingGift[] = [];

    constructor(ctx: CoopCtx) {
        this.economy = ctx.economy;
    }

    requestGold(fromId: string, toId: string): RequestResult {
        if (this._isBlocked(toId, fromId)) return { ok: false, reason: 'blocked' };
        const k = fromId + ':' + toId;
        const now = Date.now();
        const last = this.lastRequestTs.get(k) || 0;
        if (now - last < REQUEST_COOLDOWN_MS) return { ok: false, reason: 'cooldown', remainMs: REQUEST_COOLDOWN_MS - (now - last) };
        this.lastRequestTs.set(k, now);
        EventBus.emit('coop_gold_request', { fromId, toId });
        return { ok: true };
    }

    needsConfirm(fromId: string, amount: number): boolean {
        const cur = this.economy.getGold(fromId);
        return amount > cur * 0.5;
    }

    gift(fromId: string, toId: string, amount: number): GiftResult {
        if (this._isBlocked(toId, fromId)) return { ok: false, reason: 'blocked' };
        const ok = this.economy.gift(fromId, toId, amount);
        if (!ok) return { ok: false, reason: 'gold_or_limit' };
        this.pendingGifts.push({ fromId, toId, amount, ts: Date.now() });
        return { ok: true, received: Math.floor(amount * 0.8) };
    }

    onPlayerLeave(playerId: string): void {
        const now = Date.now();
        for (let i = this.pendingGifts.length - 1; i >= 0; i--) {
            const g = this.pendingGifts[i];
            if (g.fromId === playerId && now - g.ts <= GIFT_REVOKE_WINDOW_MS) {
                const received = Math.floor(g.amount * 0.8);
                this.economy.addGold(g.toId, -received, 'gift_revoke');
                this.economy.addGold(g.fromId, g.amount, 'gift_revoke');
                this.pendingGifts.splice(i, 1);
                EventBus.emit('coop_gift_revoked', g);
            }
        }
    }

    cleanupGifts(): void {
        const cutoff = Date.now() - GIFT_REVOKE_WINDOW_MS;
        this.pendingGifts = this.pendingGifts.filter((g) => g.ts > cutoff);
    }

    block(blockerId: string, blockedId: string): void {
        if (!this.blocks.has(blockerId)) this.blocks.set(blockerId, new Set());
        this.blocks.get(blockerId)!.add(blockedId);
    }

    unblock(blockerId: string, blockedId: string): void {
        const s = this.blocks.get(blockerId);
        if (s) s.delete(blockedId);
    }

    private _isBlocked(blockerId: string, blockedId: string): boolean {
        const s = this.blocks.get(blockerId);
        return !!(s && s.has(blockedId));
    }

    pinMap(playerId: string, x: number, y: number, kind?: string): MapPin {
        const pin: MapPin = { playerId, x, y, kind: kind || 'attention', ts: Date.now(), durationMs: PIN_DURATION_MS };
        EventBus.emit('coop_pin_placed', pin);
        setTimeout(() => EventBus.emit('coop_pin_expired', pin), PIN_DURATION_MS);
        return pin;
    }

    requestBuildTower(fromId: string, toId: string, towerType: string, x: number, y: number): { ok: boolean; reason?: string; request?: BuildRequest } {
        if (this._isBlocked(toId, fromId)) return { ok: false, reason: 'blocked' };
        const req: BuildRequest = { fromId, toId, towerType, x, y, ts: Date.now() };
        EventBus.emit('coop_build_request', req);
        return { ok: true, request: req };
    }

    respondBuildRequest(toId: string, request: BuildRequest, accept: boolean): void {
        EventBus.emit('coop_build_response', { request, accept, responderId: toId });
    }
}
