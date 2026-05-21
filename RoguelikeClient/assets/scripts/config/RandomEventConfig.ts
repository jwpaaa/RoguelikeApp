/**
 * 随机事件配置（来自需求文档 §F-3.6）
 * ---------------------------------------------------------------
 * 触发：每波结束（不含 BOSS 波）有 15% 概率触发 1 个随机事件。
 */

export const RandomEventId = Object.freeze({
    SHOP_DISCOUNT:    'SHOP_DISCOUNT',
    TREASURE_CHEST:   'TREASURE_CHEST',
    CURSE:            'CURSE',
    DIVINE:           'DIVINE',
    REBELLION:        'REBELLION',
    LUCKY_DAY:        'LUCKY_DAY',
    TOWER_BLESS:      'TOWER_BLESS',
});

export type RandomEventIdValue = typeof RandomEventId[keyof typeof RandomEventId];

export interface RandomEventDef {
    id: RandomEventIdValue;
    name: string;
    icon: string;
    positive: boolean;
    desc: string;
}

export const RandomEventPool: RandomEventDef[] = [
    { id: RandomEventId.SHOP_DISCOUNT,  name: '商人路过',     icon: '🏷️', positive: true,  desc: '下波前商店所有商品 5 折' },
    { id: RandomEventId.TREASURE_CHEST, name: '发现宝箱',     icon: '📦', positive: true,  desc: '立刻获得 50~200 随机金币' },
    { id: RandomEventId.CURSE,          name: '黑暗降临',     icon: '🌑', positive: false, desc: '下一波随机 1 个塔被禁用' },
    { id: RandomEventId.DIVINE,         name: '神力庇护',     icon: '✨', positive: true,  desc: '水晶恢复 2 点生命' },
    { id: RandomEventId.REBELLION,      name: '暴风雨前夜',   icon: '🌪️', positive: false, desc: '下一波怪物数量 +50%' },
    { id: RandomEventId.LUCKY_DAY,      name: '双倍快乐',     icon: '🎉', positive: true,  desc: '下一波金币获取翻倍' },
    { id: RandomEventId.TOWER_BLESS,    name: '附魔师来访',   icon: '🔮', positive: true,  desc: '随机 1 个塔获得永久攻击 +30%' },
];

export const TRIGGER_RATE = 0.15;
