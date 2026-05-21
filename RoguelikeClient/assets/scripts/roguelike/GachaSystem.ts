/**
 * 抽卡系统（来自需求文档 §F-3.3 / §5.4）
 */

import {
    Rarity, RarityRate, PityRule, DUPLICATE_REFUND,
    CardPoolN, CardPoolR, CardPoolSR, CardPoolSSR,
    type GachaCard, type RarityValue,
} from '@rtd/shared';
import { instance as EventBus } from '../core/EventBus';
import type { SeededRandom } from '../utils/SeededRandom';
import type { BuffManager } from '../battle/BuffManager';
import type { EconomyManager } from '../battle/EconomyManager';

export interface GachaCtx {
    rng: SeededRandom;
    buffManager: BuffManager;
    economy: EconomyManager;
    getSrBonus?: (playerId: string) => number;
}

export interface DrawResult {
    card: GachaCard;
    refundedGold: number;
}

interface PlayerGachaState {
    sinceSR: number;
    sinceSSR: number;
    owned: Set<string>;
}

export class GachaSystem {
    public rng: SeededRandom;
    public bm: BuffManager;
    public economy: EconomyManager;
    public getSrBonus: (playerId: string) => number;
    public state: Map<string, PlayerGachaState> = new Map();

    constructor(ctx: GachaCtx) {
        this.rng = ctx.rng;
        this.bm = ctx.buffManager;
        this.economy = ctx.economy;
        this.getSrBonus = ctx.getSrBonus || (() => 0);
    }

    initPlayer(playerId: string): void {
        if (!this.state.has(playerId)) {
            this.state.set(playerId, { sinceSR: 0, sinceSSR: 0, owned: new Set() });
        }
    }

    draw(playerId: string): DrawResult {
        this.initPlayer(playerId);
        const st = this.state.get(playerId)!;

        let rarity: RarityValue;
        st.sinceSSR++;
        st.sinceSR++;
        if (st.sinceSSR >= PityRule.SSR_PITY) {
            rarity = Rarity.SSR;
        } else if (st.sinceSR >= PityRule.SR_PITY) {
            rarity = Rarity.SR;
        } else {
            rarity = this._rollRarity(playerId);
        }

        if (rarity === Rarity.SR)  st.sinceSR  = 0;
        if (rarity === Rarity.SSR) { st.sinceSSR = 0; st.sinceSR = 0; }

        const pool = this._getPool(rarity);
        const card = this.rng.pickOne(pool)! as GachaCard;

        let refundedGold = 0;
        if (card.unique && st.owned.has(card.id)) {
            refundedGold = DUPLICATE_REFUND[rarity] || 0;
            this.economy.addGold(playerId, refundedGold, 'gacha_dup');
        } else {
            st.owned.add(card.id);
            this.bm.applyEffect(playerId, card);
        }

        EventBus.emit('gacha_drawn', { playerId, card, refundedGold });
        return { card, refundedGold };
    }

    private _rollRarity(playerId: string): RarityValue {
        const r = this.rng.next();
        const srBonus = this.getSrBonus(playerId);
        const ssr = RarityRate.SSR;
        const sr  = RarityRate.SR + srBonus;
        const rr  = RarityRate.R;
        if (r < ssr) return Rarity.SSR;
        if (r < ssr + sr) return Rarity.SR;
        if (r < ssr + sr + rr) return Rarity.R;
        return Rarity.N;
    }

    private _getPool(rarity: RarityValue): readonly GachaCard[] {
        switch (rarity) {
            case Rarity.SSR: return CardPoolSSR;
            case Rarity.SR:  return CardPoolSR;
            case Rarity.R:   return CardPoolR;
            default:         return CardPoolN;
        }
    }
}
