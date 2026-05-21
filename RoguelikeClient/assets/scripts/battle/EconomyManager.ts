/**
 * 经济系统（独立金币 + 赠送折损）
 */

import { GIFT_LOSS_RATE } from '../config/DifficultyConfig';
import { instance as EventBus } from '../core/EventBus';

export class EconomyManager {
    public gold:      Map<string, number> = new Map();
    public gainMul:   Map<string, number> = new Map();
    public costMul:   Map<string, number> = new Map();
    public giftCount: Map<string, number> = new Map();

    init(playerId: string, startGold: number): void {
        this.gold.set(playerId, startGold);
        this.gainMul.set(playerId, 1);
        this.costMul.set(playerId, 1);
        this.giftCount.set(playerId, 0);
    }

    has(playerId: string): boolean { return this.gold.has(playerId); }

    getGold(playerId: string): number { return this.gold.get(playerId) || 0; }

    addGold(playerId: string, delta: number, reason?: string): number {
        const cur = this.gold.get(playerId) || 0;
        let final = delta;
        if (delta > 0) {
            const mul = this.gainMul.get(playerId) || 1;
            final = Math.round(delta * mul);
        }
        const next = Math.max(0, cur + final);
        this.gold.set(playerId, next);
        EventBus.emit('economy_change', { playerId, delta: next - cur, reason, gold: next });
        return next - cur;
    }

    setGold(playerId: string, value: number): void {
        const cur = this.gold.get(playerId) || 0;
        this.gold.set(playerId, Math.max(0, value));
        EventBus.emit('economy_change', { playerId, delta: value - cur, reason: 'set', gold: value });
    }

    canAfford(playerId: string, baseCost: number): boolean {
        const mul = this.costMul.get(playerId) || 1;
        const real = Math.max(0, Math.round(baseCost * mul));
        return (this.gold.get(playerId) || 0) >= real;
    }

    /** 实际扣费，返回真实消耗金额；-1 表示金币不足 */
    spend(playerId: string, baseCost: number, reason?: string): number {
        const mul = this.costMul.get(playerId) || 1;
        const real = Math.max(0, Math.round(baseCost * mul));
        if ((this.gold.get(playerId) || 0) < real) return -1;
        this.gold.set(playerId, this.gold.get(playerId)! - real);
        EventBus.emit('economy_change', { playerId, delta: -real, reason, gold: this.gold.get(playerId) });
        return real;
    }

    gift(fromId: string, toId: string, amount: number): boolean {
        if (fromId === toId) return false;
        if ((this.giftCount.get(fromId) || 0) >= 5) return false;
        const cur = this.gold.get(fromId) || 0;
        if (cur < amount) return false;
        this.gold.set(fromId, cur - amount);
        const received = Math.floor(amount * (1 - GIFT_LOSS_RATE));
        this.gold.set(toId, (this.gold.get(toId) || 0) + received);
        this.giftCount.set(fromId, (this.giftCount.get(fromId) || 0) + 1);
        EventBus.emit('economy_change', { playerId: fromId, delta: -amount, reason: 'gift_out' });
        EventBus.emit('economy_change', { playerId: toId, delta: received, reason: 'gift_in' });
        return true;
    }

    resetWaveBuffs(): void {
        for (const k of this.gainMul.keys()) this.gainMul.set(k, 1);
        for (const k of this.costMul.keys()) this.costMul.set(k, 1);
    }

    addGainMul(playerId: string, deltaPct: number): void {
        this.gainMul.set(playerId, (this.gainMul.get(playerId) || 1) * (1 + deltaPct));
    }

    addCostMul(playerId: string, deltaPct: number): void {
        this.costMul.set(playerId, (this.costMul.get(playerId) || 1) * (1 + deltaPct));
    }
}
