/**
 * 商店配置（来自需求文档 §F-2.4.1）
 */

import { ItemType, ItemConfig } from './ItemConfig';

export const ShopTier = Object.freeze({
    BASIC:    'BASIC',
    ADVANCED: 'ADVANCED',
    PREMIUM:  'PREMIUM',
    BOSS:     'BOSS',
});

export type ShopTierValue = typeof ShopTier[keyof typeof ShopTier];

export interface ShopTierDef {
    count: number;
    srChance: number;
    discount: number;
}

export const ShopTierConfig: Record<ShopTierValue, ShopTierDef> = Object.freeze({
    [ShopTier.BASIC]:    { count: 3, srChance: 0,    discount: 1.0 },
    [ShopTier.ADVANCED]: { count: 4, srChance: 0,    discount: 1.0 },
    [ShopTier.PREMIUM]:  { count: 5, srChance: 0.10, discount: 1.0 },
    [ShopTier.BOSS]:     { count: 5, srChance: 0,    discount: 0.8 },
});

/** 波次 → 商店类型 */
export function getShopTierByWave(wave: number): ShopTierValue | null {
    if (wave === 3)  return ShopTier.BASIC;
    if (wave === 7)  return ShopTier.ADVANCED;
    if (wave === 12) return ShopTier.PREMIUM;
    if (wave === 17) return ShopTier.BOSS;
    return null;
}

export const GoodsKind = Object.freeze({
    ITEM:           'ITEM',
    GOLD_PACK:      'GOLD_PACK',
    DICE_REROLL:    'DICE_REROLL',
    TOWER_PROMOTE:  'TOWER_PROMOTE',
    RELIC:          'RELIC',
});

export type GoodsKindValue = typeof GoodsKind[keyof typeof GoodsKind];

export const GoldPacks: ReadonlyArray<{ goldAmount: number; price: number }> = [
    { goldAmount: 100, price: 120 },
    { goldAmount: 200, price: 220 },
    { goldAmount: 300, price: 300 },
];

export interface SpecialGoodsDef {
    kind: GoodsKindValue;
    id: string;
    name: string;
    icon: string;
    price: number;
    desc: string;
}

export const SpecialGoods: SpecialGoodsDef[] = [
    { kind: GoodsKind.DICE_REROLL,   id: 'GD-DICE',    name: '骰子重掷券', icon: '🎲', price: 150, desc: '下次掷骰可重掷 1 次（取好结果）' },
    { kind: GoodsKind.TOWER_PROMOTE, id: 'GD-PROMOTE', name: '塔强化券',   icon: '⭐', price: 200, desc: '指定 1 个塔直升 1 级（不消耗金币）' },
];

export const PRICE_FLUCT_MIN = 0.8;
export const PRICE_FLUCT_MAX = 1.2;
export const MAX_REFRESH_PER_SHOP = 2;
export const REFRESH_COST = 30;
export const SHOP_TIMEOUT_MS = 60000;

// 抑制未使用警告（ItemType 在其它文件 import 用）
void ItemType;
void ItemConfig;
