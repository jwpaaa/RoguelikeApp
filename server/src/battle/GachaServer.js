/**
 * 服务端抽卡（真随机 + 保底，来自需求文档 §F-3.3 / §5.4）
 * ---------------------------------------------------------------
 * - 保底计数器持久化：服务端按玩家累计（赛季级别），重启不丢
 *   （由 PityStore 接口注入，默认走内存）
 * - 重复 unique 卡返回金币补偿（客户端按 refundedGold 处理）
 */

'use strict';

const crypto = require('crypto');
const { pickNReal } = require('../util/Helpers');

const Rarity = { N: 'N', R: 'R', SR: 'SR', SSR: 'SSR' };
const RarityRate = { N: 0.55, R: 0.30, SR: 0.12, SSR: 0.03 };
const PITY = { SR: 5, SSR: 15 };
const DUP_REFUND = { N: 30, R: 80, SR: 200, SSR: 500 };

const CardPoolN = [
    { id: 'N-01', rarity: 'N', name: '金币袋',   desc: '+50金币',               duration: 'INSTANT',   effect: { target: 'ECONOMY', kind: 'GOLD_ADD', value: 50 } },
    { id: 'N-02', rarity: 'N', name: '小额强化', desc: '随机1塔攻击+10%',       duration: 'PERMANENT', effect: { target: 'RANDOM_TOWER', kind: 'ATK_PCT', value: 0.10 } },
    { id: 'N-03', rarity: 'N', name: '维修工具', desc: '水晶+1生命',            duration: 'INSTANT',   effect: { target: 'CRYSTAL', kind: 'HEAL', value: 1 } },
    { id: 'N-04', rarity: 'N', name: '加速券',   desc: '下波怪物移速-10%',      duration: 'ONE_WAVE',  effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'SPEED_PCT', value: -0.10 } },
];
const CardPoolR = [
    { id: 'R-01', rarity: 'R', name: '塔解锁·随机', desc: '解锁1未拥有塔',      duration: 'PERMANENT', effect: { target: 'TOWER_UNLOCK', kind: 'UNLOCK_RANDOM', value: 1 } },
    { id: 'R-02', rarity: 'R', name: '塔强化券',     desc: '选1塔升至Lv.2',     duration: 'INSTANT',   effect: { target: 'CHOSEN_TOWER', kind: 'UPGRADE_TO', value: 2 } },
    { id: 'R-03', rarity: 'R', name: '属性爆发',     desc: '塔攻击+15%、攻速+15%', duration: 'PERMANENT', effect: { target: 'SELF_TOWERS', kind: 'ATK_AND_SPD', value: 0.15 } },
    { id: 'R-04', rarity: 'R', name: '金币加成',     desc: '每波金币+30%',       duration: 'PERMANENT', effect: { target: 'ECONOMY', kind: 'WAVE_REWARD_PCT', value: 0.30 } },
];
const CardPoolSR = [
    { id: 'SR-01', rarity: 'SR', name: '远古遗物·暴击', desc: '暴击+20%、暴伤+50%', duration: 'PERMANENT', unique: true, effect: { target: 'SELF_TOWERS', kind: 'CRIT_AND_DMG', value: { crit: 0.20, critDmg: 0.50 } } },
    { id: 'SR-02', rarity: 'SR', name: '远古遗物·财宝', desc: '每波结束+150金',     duration: 'PERMANENT', unique: true, effect: { target: 'ECONOMY', kind: 'WAVE_BONUS_GOLD', value: 150 } },
    { id: 'SR-03', rarity: 'SR', name: '远古遗物·壁垒', desc: '水晶最大+3、每5波+1', duration: 'PERMANENT', unique: true, effect: { target: 'CRYSTAL', kind: 'HP_AND_REGEN', value: { hp: 3, every: 5, heal: 1 } } },
    { id: 'SR-04', rarity: 'SR', name: '远古遗物·急速', desc: '攻速+30%、建造-20%', duration: 'PERMANENT', unique: true, effect: { target: 'SELF_TOWERS', kind: 'SPD_AND_COST', value: { spd: 0.30, cost: -0.20 } } },
    { id: 'SR-05', rarity: 'SR', name: '骰子操控',       desc: '下次掷骰可重掷1次', duration: 'PERMANENT', unique: true, effect: { target: 'PLAYER', kind: 'DICE_REROLL', value: 1 } },
];
const CardPoolSSR = [
    { id: 'SSR-01', rarity: 'SSR', name: '命运之眼',  desc: '掷骰可见三池并自选',   duration: 'PERMANENT', unique: true, effect: { target: 'PLAYER', kind: 'DICE_FORESIGHT', value: 1 } },
    { id: 'SSR-02', rarity: 'SSR', name: '时间加速',  desc: '所有塔攻速翻倍',       duration: 'PERMANENT', unique: true, effect: { target: 'SELF_TOWERS', kind: 'SPD_PCT', value: 1.00 } },
    { id: 'SSR-03', rarity: 'SSR', name: '即死诅咒',  desc: '攻击5%几率秒杀非BOSS', duration: 'PERMANENT', unique: true, effect: { target: 'SELF_TOWERS', kind: 'INSTAKILL_PCT', value: 0.05 } },
    { id: 'SSR-04', rarity: 'SSR', name: '不朽水晶',  desc: '5层护盾+每5波补1层',   duration: 'PERMANENT', unique: true, effect: { target: 'CRYSTAL', kind: 'SHIELD_AND_REGEN', value: { shield: 5, every: 5, add: 1 } } },
    { id: 'SSR-05', rarity: 'SSR', name: '黄金时代',  desc: '金币翻倍+建造减半，3波', duration: 'ONE_WAVE',  effect: { target: 'PLAYER', kind: 'GOLDEN_AGE', value: { duration: 3 } } },
];

class GachaServer {
    /**
     * @param {object} [pityStore] 持久化保底计数器；默认走内存
     */
    constructor(pityStore) {
        this.pity = pityStore || new MemoryPityStore();
    }

    /**
     * 抽 1 次
     * @param {{ openid:string, srBonus?:number, ownedIds?:string[] }} ctx
     * @returns {Promise<{ card:object, refundedGold:number, rarity:string }>}
     */
    async draw(ctx) {
        const state = await this.pity.get(ctx.openid) || { sinceSR: 0, sinceSSR: 0 };
        state.sinceSR++;
        state.sinceSSR++;

        let rarity;
        if (state.sinceSSR >= PITY.SSR) rarity = Rarity.SSR;
        else if (state.sinceSR >= PITY.SR) rarity = Rarity.SR;
        else rarity = this._rollRarity(ctx.srBonus || 0);

        if (rarity === Rarity.SR)  state.sinceSR  = 0;
        if (rarity === Rarity.SSR) { state.sinceSSR = 0; state.sinceSR = 0; }
        await this.pity.set(ctx.openid, state);

        const pool = this._poolOf(rarity);
        const card = pool[Math.floor(randFloat() * pool.length)];

        let refundedGold = 0;
        const ownedSet = new Set(ctx.ownedIds || []);
        if (card.unique && ownedSet.has(card.id)) {
            refundedGold = DUP_REFUND[rarity] || 0;
        }
        return { card, refundedGold, rarity };
    }

    _rollRarity(srBonus) {
        const r = randFloat();
        const ssr = RarityRate.SSR;
        const sr  = RarityRate.SR + srBonus;
        const rr  = RarityRate.R;
        if (r < ssr) return Rarity.SSR;
        if (r < ssr + sr) return Rarity.SR;
        if (r < ssr + sr + rr) return Rarity.R;
        return Rarity.N;
    }

    _poolOf(r) {
        switch (r) {
            case Rarity.SSR: return CardPoolSSR;
            case Rarity.SR:  return CardPoolSR;
            case Rarity.R:   return CardPoolR;
            default:         return CardPoolN;
        }
    }
}

function randFloat() {
    const buf = crypto.randomBytes(4);
    return buf.readUInt32BE(0) / 0xFFFFFFFF;
}

class MemoryPityStore {
    constructor() { this._map = new Map(); }
    async get(openid) { return this._map.get(openid); }
    async set(openid, state) { this._map.set(openid, state); }
}

module.exports = { GachaServer, MemoryPityStore };
