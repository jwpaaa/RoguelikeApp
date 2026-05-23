/**
 * 波次间商店控制器（来自需求文档 §F-2.4.1）
 */

import {
    ShopTier, ShopTierConfig, getShopTierByWave,
    GoodsKind, GoldPacks, SpecialGoods,
    PRICE_FLUCT_MIN, PRICE_FLUCT_MAX,
    MAX_REFRESH_PER_SHOP, REFRESH_COST,
    SHOP_TIMEOUT_MS,
    type ShopTierValue, type GoodsKindValue,
} from '../config/ShopConfig';
import { ItemConfig, ItemType, type ItemTypeValue } from '../config/ItemConfig';
import { CardPoolSR, type GachaCard } from '../../shared/index';
import { instance as EventBus } from '../core/EventBus';
import type { SeededRandom } from '../utils/SeededRandom';
import type { EconomyManager } from './EconomyManager';
import type { ItemController } from './ItemController';
import type { BuffManager } from './BuffManager';
import type { TowerController } from './TowerController';
import type { DiceSystem } from '../roguelike/DiceSystem';

export interface ShopCtx {
    rng: SeededRandom;
    economy: EconomyManager;
    items: ItemController;
    buffManager: BuffManager;
    towerController: TowerController;
    diceSystem: DiceSystem;
}

export interface GoodsItem {
    kind: GoodsKindValue;
    id: string;
    name: string;
    icon: string;
    desc: string;
    price: number;
    goldAmount?: number;
    relic?: GachaCard;
}

export interface PerPlayerState {
    goods: GoodsItem[];
    sold: boolean[];
    refreshLeft: number;
    finished: boolean;
    openTimeMs: number;
}

export interface BuyResult { ok: boolean; reason?: string; }

export class ShopController {
    public rng: SeededRandom;
    public economy: EconomyManager;
    public items: ItemController;
    public bm: BuffManager;
    public tc: TowerController;
    public dice: DiceSystem;

    public tier: ShopTierValue | null = null;
    public perPlayerState: Map<string, PerPlayerState> = new Map();
    private _nextDiscount: number = 1.0;
    private _timerMs: number = 0;

    constructor(ctx: ShopCtx) {
        this.rng = ctx.rng;
        this.economy = ctx.economy;
        this.items = ctx.items;
        this.bm = ctx.buffManager;
        this.tc = ctx.towerController;
        this.dice = ctx.diceSystem;
    }

    setNextDiscount(d: number): void { this._nextDiscount = d; }

    openIfTriggered(wave: number, playerIds: string[]): { tier: ShopTierValue } | null {
        const tier = getShopTierByWave(wave);
        if (!tier) return null;
        this.tier = tier;
        this.perPlayerState.clear();
        for (const pid of playerIds) this.perPlayerState.set(pid, this._generate(tier));
        this._timerMs = SHOP_TIMEOUT_MS;
        EventBus.emit('shop_open', { tier, perPlayer: this._snapshot() });
        return { tier };
    }

    buy(playerId: string, slotIdx: number, extra?: { towerId?: string }): BuyResult {
        const st = this.perPlayerState.get(playerId);
        if (!st || st.finished) return { ok: false, reason: 'no_shop' };
        const goods = st.goods[slotIdx];
        if (!goods) return { ok: false, reason: 'no_slot' };
        if (st.sold[slotIdx]) return { ok: false, reason: 'sold' };
        const finalPrice = Math.max(0, Math.round(goods.price * ShopTierConfig[this.tier!].discount * this._nextDiscount));
        const real = this.economy.spend(playerId, finalPrice, 'shop_buy');
        if (real < 0) return { ok: false, reason: 'gold' };

        st.sold[slotIdx] = true;
        this._applyGoods(playerId, goods, extra);
        EventBus.emit('shop_bought', { playerId, slotIdx, goods, finalPrice });
        return { ok: true };
    }

    refresh(playerId: string): BuyResult {
        const st = this.perPlayerState.get(playerId);
        if (!st || st.finished) return { ok: false, reason: 'no_shop' };
        if (st.refreshLeft <= 0) return { ok: false, reason: 'no_refresh' };
        const real = this.economy.spend(playerId, REFRESH_COST, 'shop_refresh');
        if (real < 0) return { ok: false, reason: 'gold' };
        const fresh = this._generate(this.tier!);
        fresh.refreshLeft = st.refreshLeft - 1;
        this.perPlayerState.set(playerId, fresh);
        EventBus.emit('shop_refreshed', { playerId, refreshLeft: fresh.refreshLeft });
        return { ok: true };
    }

    close(playerId: string): boolean {
        const st = this.perPlayerState.get(playerId);
        if (!st) return false;
        st.finished = true;
        EventBus.emit('shop_closed', { playerId });
        return true;
    }

    isAllClosed(): boolean {
        for (const st of this.perPlayerState.values()) if (!st.finished) return false;
        return true;
    }

    tick(dtMs: number): boolean {
        if (this.tier === null) return false;
        this._timerMs -= dtMs;
        if (this._timerMs <= 0) {
            for (const st of this.perPlayerState.values()) st.finished = true;
            return true;
        }
        return false;
    }

    reset(): void {
        this.tier = null;
        this.perPlayerState.clear();
        this._nextDiscount = 1.0;
    }

    private _snapshot(): Record<string, { goods: GoodsItem[]; sold: boolean[]; refreshLeft: number }> {
        const out: Record<string, { goods: GoodsItem[]; sold: boolean[]; refreshLeft: number }> = {};
        for (const [pid, st] of this.perPlayerState) {
            out[pid] = { goods: st.goods.slice(), sold: st.sold.slice(), refreshLeft: st.refreshLeft };
        }
        return out;
    }

    private _generate(tier: ShopTierValue): PerPlayerState {
        const cfg = ShopTierConfig[tier];
        const goods: GoodsItem[] = [];
        const itemTypes = Object.values(ItemType);

        const wantItems = this.rng.nextIntInclusive(2, 3);
        const wantPacks = this.rng.nextIntInclusive(1, 2);
        const wantSpecial = this.rng.nextBool() ? 1 : 0;

        for (let i = 0; i < wantItems && goods.length < cfg.count; i++) {
            const t = this.rng.pickOne(itemTypes) as ItemTypeValue;
            const item = ItemConfig[t];
            goods.push({
                kind: GoodsKind.ITEM, id: item.id, name: item.name, icon: item.icon, desc: item.desc,
                price: this._fluct(item.price || 100),
            });
        }
        for (let i = 0; i < wantPacks && goods.length < cfg.count; i++) {
            const p = this.rng.pickOne(GoldPacks)!;
            goods.push({
                kind: GoodsKind.GOLD_PACK, id: 'GP-' + p.goldAmount,
                name: '金币 +' + p.goldAmount, icon: '💰',
                desc: '立即获得 ' + p.goldAmount + ' 金币',
                price: this._fluct(p.price), goldAmount: p.goldAmount,
            });
        }
        for (let i = 0; i < wantSpecial && goods.length < cfg.count; i++) {
            const s = this.rng.pickOne(SpecialGoods)!;
            goods.push({ ...s, price: this._fluct(s.price) });
        }
        if (cfg.srChance > 0 && goods.length < cfg.count && this.rng.next() < cfg.srChance) {
            const card: GachaCard = this.rng.pickOne(CardPoolSR)!;
            goods.push({
                kind: GoodsKind.RELIC, id: card.id, name: card.name, icon: '🏆',
                desc: card.desc, price: 800, relic: card,
            });
        }
        // 不足 count → 补金币包
        while (goods.length < cfg.count) {
            const p = GoldPacks[0];
            goods.push({
                kind: GoodsKind.GOLD_PACK, id: 'GP-' + p.goldAmount,
                name: '金币 +' + p.goldAmount, icon: '💰',
                desc: '立即获得 ' + p.goldAmount + ' 金币',
                price: this._fluct(p.price), goldAmount: p.goldAmount,
            });
        }

        return { goods, sold: new Array(goods.length).fill(false), refreshLeft: MAX_REFRESH_PER_SHOP, finished: false, openTimeMs: Date.now() };
    }

    private _fluct(base: number): number {
        const r = PRICE_FLUCT_MIN + this.rng.next() * (PRICE_FLUCT_MAX - PRICE_FLUCT_MIN);
        return Math.max(1, Math.round(base * r));
    }

    private _applyGoods(playerId: string, goods: GoodsItem, extra?: { towerId?: string }): void {
        switch (goods.kind) {
            case GoodsKind.ITEM:
                this.items.add(playerId, goods.id, 1);
                break;
            case GoodsKind.GOLD_PACK:
                this.economy.addGold(playerId, goods.goldAmount || 0, 'shop_pack');
                break;
            case GoodsKind.DICE_REROLL:
                this.dice.grantReroll(playerId, 1);
                break;
            case GoodsKind.TOWER_PROMOTE: {
                const towerId = extra && extra.towerId;
                if (towerId) {
                    const t = this.tc.em.towers.get(towerId);
                    if (t && t.ownerId === playerId && t.level < 3) {
                        t.level += 1;
                        EventBus.emit('tower_upgraded', t);
                    }
                }
                break;
            }
            case GoodsKind.RELIC: {
                if (goods.relic) this.bm.applyEffect(playerId, goods.relic as unknown as Parameters<BuffManager['applyEffect']>[1]);
                break;
            }
            default: break;
        }
    }
}

// 抑制未使用类型导入
void ShopTier;
