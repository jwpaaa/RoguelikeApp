/**
 * 服务端骰子（真随机，来自需求文档 §F-3.1 / 技术文档_02 §1.3）
 * ---------------------------------------------------------------
 * 文档明确："骰子结果服务端独立真随机，不依赖客户端种子（防预测）"
 * 因此本类不使用 SeededRandom，而是 crypto.randomBytes 真随机。
 *
 * 输出：选中的 3 个效果（id + 完整 effect 描述），客户端按 id 应用。
 */

'use strict';

const crypto = require('crypto');
const { pickNReal, pickWeightedReal } = require('../util/Helpers');

// 与客户端 DicePoolConfig 共用同一份"效果库"
const DiceCategory = {
    SELF_BUFF: 'SELF_BUFF', ENEMY_DEBUFF: 'ENEMY_DEBUFF',
    ENEMY_BUFF: 'ENEMY_BUFF', ALLY_DEBUFF: 'ALLY_DEBUFF',
};
const Duration = { PERMANENT: 'PERMANENT', ONE_WAVE: 'ONE_WAVE', INSTANT: 'INSTANT' };

const SelfBuffPool = [
    { id: 'B-01', name: '攻击强化', desc: '所有塔攻击+20%',     category: DiceCategory.SELF_BUFF, duration: Duration.PERMANENT, effect: { target: 'SELF_TOWERS', kind: 'ATK_PCT', value: 0.20 } },
    { id: 'B-02', name: '精准打击', desc: '所有塔暴击+15%',     category: DiceCategory.SELF_BUFF, duration: Duration.PERMANENT, effect: { target: 'SELF_TOWERS', kind: 'CRIT_PCT', value: 0.15 } },
    { id: 'B-03', name: '淘金热',   desc: '下波金币+50%',       category: DiceCategory.SELF_BUFF, duration: Duration.ONE_WAVE,  effect: { target: 'ECONOMY', kind: 'GOLD_GAIN', value: 0.50 } },
    { id: 'B-04', name: '极速建造', desc: '本回合建造-30%',     category: DiceCategory.SELF_BUFF, duration: Duration.ONE_WAVE,  effect: { target: 'ECONOMY', kind: 'COST_PCT', value: -0.30 } },
    { id: 'B-05', name: '水晶护盾', desc: '水晶+1层护盾',       category: DiceCategory.SELF_BUFF, duration: Duration.PERMANENT, effect: { target: 'CRYSTAL', kind: 'SHIELD', value: 1 } },
    { id: 'B-06', name: '射程扩展', desc: '所有塔射程+0.5',     category: DiceCategory.SELF_BUFF, duration: Duration.PERMANENT, effect: { target: 'SELF_TOWERS', kind: 'RANGE_ADD', value: 0.5 } },
    { id: 'B-07', name: '生命恢复', desc: '水晶+1生命',         category: DiceCategory.SELF_BUFF, duration: Duration.INSTANT,   effect: { target: 'CRYSTAL', kind: 'HEAL', value: 1 } },
    { id: 'B-08', name: '攻速提升', desc: '所有塔攻速+20%',     category: DiceCategory.SELF_BUFF, duration: Duration.PERMANENT, effect: { target: 'SELF_TOWERS', kind: 'SPD_PCT', value: 0.20 } },
    { id: 'B-09', name: '火焰附魔', desc: '所有塔附带灼烧2/s', category: DiceCategory.SELF_BUFF, duration: Duration.PERMANENT, effect: { target: 'SELF_TOWERS', kind: 'BURN', value: 2 } },
    { id: 'B-10', name: '意外之财', desc: '+200金币',           category: DiceCategory.SELF_BUFF, duration: Duration.INSTANT,   effect: { target: 'ECONOMY', kind: 'GOLD_ADD', value: 200 } },
];
const EnemyDebuffPool = [
    { id: 'D-01', name: '群体减速', desc: '下波怪物移速-25%',   category: DiceCategory.ENEMY_DEBUFF, duration: Duration.ONE_WAVE, effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'SPEED_PCT', value: -0.25 } },
    { id: 'D-02', name: '易伤标记', desc: '下波怪物受伤+25%',   category: DiceCategory.ENEMY_DEBUFF, duration: Duration.ONE_WAVE, effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'TAKEN_PCT', value: 0.25 } },
    { id: 'D-03', name: '破甲诅咒', desc: '下波怪物护甲-50%',   category: DiceCategory.ENEMY_DEBUFF, duration: Duration.ONE_WAVE, effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'ARMOR_PCT', value: -0.50 } },
    { id: 'D-04', name: '生命削减', desc: '下波怪物HP-15%',     category: DiceCategory.ENEMY_DEBUFF, duration: Duration.ONE_WAVE, effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'HP_PCT', value: -0.15 } },
    { id: 'D-05', name: '麻痹陷阱', desc: '下波怪物周期麻痹', category: DiceCategory.ENEMY_DEBUFF, duration: Duration.ONE_WAVE, effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'PARALYZE', value: 1 } },
    { id: 'D-06', name: '伤害弱化', desc: '下波怪物对水晶-1', category: DiceCategory.ENEMY_DEBUFF, duration: Duration.ONE_WAVE, effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'DMG_TO_CRYSTAL', value: -1 } },
    { id: 'D-07', name: '混乱',     desc: '下波怪物10%回头',   category: DiceCategory.ENEMY_DEBUFF, duration: Duration.ONE_WAVE, effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'CONFUSE', value: 0.10 } },
];
const EnemyBuffPool = [
    { id: 'M-01', name: '怪物强化', desc: '下波怪物HP+25%',     category: DiceCategory.ENEMY_BUFF, duration: Duration.ONE_WAVE, effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'HP_PCT', value: 0.25 } },
    { id: 'M-02', name: '急速突袭', desc: '下波怪物移速+20%',   category: DiceCategory.ENEMY_BUFF, duration: Duration.ONE_WAVE, effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'SPEED_PCT', value: 0.20 } },
    { id: 'M-03', name: '铁壁防御', desc: '下波怪物护甲+30',     category: DiceCategory.ENEMY_BUFF, duration: Duration.ONE_WAVE, effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'ARMOR_ADD', value: 30 } },
    { id: 'M-04', name: '狂暴',     desc: '下波怪物对水晶+1',    category: DiceCategory.ENEMY_BUFF, duration: Duration.ONE_WAVE, effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'DMG_TO_CRYSTAL', value: 1 } },
    { id: 'M-05', name: '增援部队', desc: '下波怪物数量+20%',   category: DiceCategory.ENEMY_BUFF, duration: Duration.ONE_WAVE, effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'COUNT_PCT', value: 0.20 } },
    { id: 'M-06', name: '再生',     desc: '下波怪物每秒回1%',    category: DiceCategory.ENEMY_BUFF, duration: Duration.ONE_WAVE, effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'REGEN_PCT', value: 0.01 } },
    { id: 'M-07', name: '精英化',   desc: '下波随机1只精英化',   category: DiceCategory.ENEMY_BUFF, duration: Duration.ONE_WAVE, effect: { target: 'NEXT_WAVE_ENEMIES', kind: 'ELITE_ONE', value: 1 } },
];
const AllyDebuffPool = [
    { id: 'T-01', name: '税收',     desc: '随机队友下波金币-30%', category: DiceCategory.ALLY_DEBUFF, duration: Duration.ONE_WAVE, effect: { target: 'RANDOM_ALLY', kind: 'GOLD_GAIN_PCT', value: -0.30 } },
    { id: 'T-02', name: '塔封印',   desc: '随机冻结队友1塔5秒',   category: DiceCategory.ALLY_DEBUFF, duration: Duration.ONE_WAVE, effect: { target: 'RANDOM_ALLY', kind: 'FREEZE_TOWER', value: 5 } },
    { id: 'T-03', name: '属性衰减', desc: '随机队友塔攻击-15%',   category: DiceCategory.ALLY_DEBUFF, duration: Duration.ONE_WAVE, effect: { target: 'RANDOM_ALLY', kind: 'ATK_PCT', value: -0.15 } },
    { id: 'T-04', name: '建造迟缓', desc: '随机队友建造+30%',     category: DiceCategory.ALLY_DEBUFF, duration: Duration.ONE_WAVE, effect: { target: 'RANDOM_ALLY', kind: 'COST_PCT', value: 0.30 } },
    { id: 'T-05', name: '射程缩短', desc: '随机队友塔射程-0.5',   category: DiceCategory.ALLY_DEBUFF, duration: Duration.ONE_WAVE, effect: { target: 'RANDOM_ALLY', kind: 'RANGE_ADD', value: -0.5 } },
    { id: 'T-06', name: '攻速降低', desc: '随机队友塔攻速-20%',   category: DiceCategory.ALLY_DEBUFF, duration: Duration.ONE_WAVE, effect: { target: 'RANDOM_ALLY', kind: 'SPD_PCT', value: -0.20 } },
    { id: 'T-07', name: '金币扣除', desc: '随机队友-80金币',      category: DiceCategory.ALLY_DEBUFF, duration: Duration.INSTANT,  effect: { target: 'RANDOM_ALLY', kind: 'GOLD_ADD', value: -80 } },
];

const PICK_COUNT = 3;

class DiceServer {
    /**
     * 真随机掷一次骰子，返回结果（含 3 个效果）
     * @param {{ goodChance:number, reducedPositive?:boolean, allyIds:string[] }} ctx
     * @returns {{ dice:number, picks:Array, allyTargets:Object }}
     */
    static roll(ctx) {
        const goodChance = (typeof ctx.goodChance === 'number') ? ctx.goodChance : 0.5;
        const good = randFloat() < goodChance;
        const dice = good ? randInt(1, 4) : randInt(4, 7); // [1,4) → 1-3； [4,7) → 4-6
        const pool = (dice >= 1 && dice <= 3)
            ? (ctx.reducedPositive ? [...SelfBuffPool.slice(0, 7), ...EnemyDebuffPool] : [...SelfBuffPool, ...EnemyDebuffPool])
            : [...EnemyBuffPool, ...AllyDebuffPool];
        const picks = pickNReal(pool, PICK_COUNT);

        // 解析队友减益的目标（在所有非自己的玩家中真随机）
        const allyTargets = {};
        const allies = (ctx.allyIds || []).slice();
        for (const card of picks) {
            if (card.effect.target === 'RANDOM_ALLY') {
                if (allies.length === 0) { allyTargets[card.id] = null; continue; }
                allyTargets[card.id] = allies[randInt(0, allies.length)];
            }
        }
        return { dice, picks, allyTargets };
    }
}

function randFloat() {
    const buf = crypto.randomBytes(4);
    return buf.readUInt32BE(0) / 0xFFFFFFFF;
}
function randInt(min, max) { return min + Math.floor(randFloat() * (max - min)); }

module.exports = { DiceServer };
