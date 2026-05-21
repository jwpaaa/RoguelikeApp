/**
 * 天赋数据管理
 */

import { TalentConfig } from '../config/TalentConfig';
import { instance as User } from './UserDataManager';

export interface BattleEffects {
    startGold: number;
    crystalHp: number;
    buildDiscount: number;
    shieldBonus: number;
    diceGoodPct: number;
    gachaSrPct: number;
    allyDebuffResist: number;
    globalAtkPct: number;
    globalCritPct: number;
    unlockTargetMode: boolean;
}

export class TalentDataManager {
    /** 汇总成 BattleManager 所需的效果对象 */
    static buildBattleEffects(): BattleEffects {
        const effects: BattleEffects = {
            startGold: 0,
            crystalHp: 0,
            buildDiscount: 0,
            shieldBonus: 0,
            diceGoodPct: 0,
            gachaSrPct: 0,
            allyDebuffResist: 0,
            globalAtkPct: 0,
            globalCritPct: 0,
            unlockTargetMode: false,
        };
        const talents = User.data.talents || {};
        for (const branch of Object.values(TalentConfig)) {
            for (const node of branch) {
                const lv = talents[node.id] || 0;
                if (lv <= 0) continue;
                const v = node.effect.values[lv - 1];
                switch (node.effect.kind) {
                    case 'GLOBAL_ATK_PCT':       effects.globalAtkPct      += v; break;
                    case 'GLOBAL_CRIT':          effects.globalCritPct     += v; break;
                    case 'START_GOLD':           effects.startGold         += v; break;
                    case 'CRYSTAL_HP':           effects.crystalHp         += v; break;
                    case 'BUILD_DISCOUNT':       effects.buildDiscount     += v; break;
                    case 'SHIELD_BONUS':         effects.shieldBonus       += v; break;
                    case 'DICE_GOOD_PCT':        effects.diceGoodPct       += v; break;
                    case 'GACHA_SR_PCT':         effects.gachaSrPct        += v; break;
                    case 'ALLY_DEBUFF_RESIST':   effects.allyDebuffResist  += v; break;
                    case 'UNLOCK_TARGET_MODE':   effects.unlockTargetMode   = true; break;
                    default: break;
                }
            }
        }
        return effects;
    }

    static upgrade(talentId: string): boolean {
        for (const branch of Object.values(TalentConfig)) {
            for (const node of branch) {
                if (node.id === talentId) return User.upgradeTalent(talentId, node.costPerLevel);
            }
        }
        return false;
    }
}
