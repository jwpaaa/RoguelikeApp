/**
 * 道具配置（来自需求文档 §F-2.7）
 */

export const ItemType = Object.freeze({
    FREEZE_BOMB:    'FREEZE_BOMB',
    FULL_LIGHTNING: 'FULL_LIGHTNING',
    GOLD_RUSH:      'GOLD_RUSH',
    TEMP_SLOT:      'TEMP_SLOT',
    SHIELD_GEN:     'SHIELD_GEN',
    SLOW_TIME:      'SLOW_TIME',
});

export type ItemTypeValue = typeof ItemType[keyof typeof ItemType];

export interface ItemDef {
    id: ItemTypeValue;
    name: string;
    icon: string;
    scope: 'TEAM' | 'PLAYER';
    cooldownMs: number;
    maxStack: number;
    price?: number;
    desc: string;
    effect: { kind: string; [key: string]: number | string };
}

export const ItemConfig: Record<ItemTypeValue, ItemDef> = {
    [ItemType.FREEZE_BOMB]: {
        id: ItemType.FREEZE_BOMB, name: '冰冻炸弹', icon: '🧊', scope: 'TEAM',
        cooldownMs: 5000, maxStack: 3, price: 150,
        desc: '冻结全屏怪物 3 秒（全队受益）',
        effect: { kind: 'GLOBAL_FREEZE', durationMs: 3000 },
    },
    [ItemType.FULL_LIGHTNING]: {
        id: ItemType.FULL_LIGHTNING, name: '全屏闪电', icon: '⚡', scope: 'PLAYER',
        cooldownMs: 5000, maxStack: 3, price: 200,
        desc: '对所有怪造成"塔攻击力总和×0.5"伤害（仅使用者塔）',
        effect: { kind: 'PLAYER_LIGHTNING', factor: 0.5 },
    },
    [ItemType.GOLD_RUSH]: {
        id: ItemType.GOLD_RUSH, name: '金币加速', icon: '💰', scope: 'PLAYER',
        cooldownMs: 5000, maxStack: 3, price: 100,
        desc: '5 秒内金币获取翻倍（仅使用者）',
        effect: { kind: 'GOLD_DOUBLE', durationMs: 5000 },
    },
    [ItemType.TEMP_SLOT]: {
        id: ItemType.TEMP_SLOT, name: '临时塔位', icon: '🏗️', scope: 'PLAYER',
        cooldownMs: 5000, maxStack: 3, price: 180,
        desc: '在不可放置区域临时放 1 个塔（持续 2 波）',
        effect: { kind: 'TEMP_PLACEABLE', wavesAlive: 2 },
    },
    [ItemType.SHIELD_GEN]: {
        id: ItemType.SHIELD_GEN, name: '护盾发生器', icon: '🛡️', scope: 'TEAM',
        cooldownMs: 5000, maxStack: 3, price: 120,
        desc: '为水晶添加 1 层临时护盾（全队共享）',
        effect: { kind: 'CRYSTAL_SHIELD', layers: 1 },
    },
    [ItemType.SLOW_TIME]: {
        id: ItemType.SLOW_TIME, name: '时间缓滞', icon: '🐌', scope: 'TEAM',
        cooldownMs: 5000, maxStack: 3, price: 160,
        desc: '怪物移速 -50%，持续 5 秒（全队受益）',
        effect: { kind: 'GLOBAL_SLOW', slowPct: 0.5, durationMs: 5000 },
    },
};
