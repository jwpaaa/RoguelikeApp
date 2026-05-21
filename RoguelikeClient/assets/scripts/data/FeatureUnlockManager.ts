/**
 * 功能渐进式解锁（来自需求文档 §F-0.4）
 */

import { instance as User } from './UserDataManager';
import { instance as Guide } from './GuideDataManager';

export const Feature = Object.freeze({
    TALENT_TREE:    'TALENT_TREE',
    LEADERBOARD:    'LEADERBOARD',
    SPECTATE:       'SPECTATE',
    QUICK_MATCH:    'QUICK_MATCH',
    HARD_MODE:      'HARD_MODE',
    VOICE_CHAT:     'VOICE_CHAT',
    BATTLE_REPORT:  'BATTLE_REPORT',
    SHOP_PAY:       'SHOP_PAY',
});

export type FeatureValue = typeof Feature[keyof typeof Feature];

interface CheckCtx {
    user: typeof User;
    guide: typeof Guide;
}

const FeatureUnlock: Record<FeatureValue, (u: CheckCtx) => boolean> = {
    [Feature.TALENT_TREE]:   (u) => u.user.level >= 5,
    [Feature.LEADERBOARD]:   (u) => (u.user.data.totalBattles || 0) >= 3,
    [Feature.SPECTATE]:      (u) => u.user.level >= 3,
    [Feature.QUICK_MATCH]:   (u) => u.guide.isStageDone(3) || u.guide.isSkipped(),
    [Feature.HARD_MODE]:     (u) => (u.user.data.completedNormal || 0) >= 1,
    [Feature.VOICE_CHAT]:    (u) => (u.user.data.completedMP || 0) >= 1,
    [Feature.BATTLE_REPORT]: (u) => (u.user.data.totalWins || 0) >= 1,
    [Feature.SHOP_PAY]:      (u) => !!u.user.data.realNameVerified,
};

const FeatureHint: Record<FeatureValue, string> = {
    [Feature.TALENT_TREE]:   '达到 5 级后解锁',
    [Feature.LEADERBOARD]:   '完成 3 场对局后解锁',
    [Feature.SPECTATE]:      '达到 3 级后解锁',
    [Feature.QUICK_MATCH]:   '请先完成新手引导',
    [Feature.HARD_MODE]:     '通关一次中等难度后解锁',
    [Feature.VOICE_CHAT]:    '完成一场联机对局后解锁',
    [Feature.BATTLE_REPORT]: '完成一次对局后解锁',
    [Feature.SHOP_PAY]:      '请先完成实名认证',
};

export class FeatureUnlockManager {
    static isUnlocked(feature: FeatureValue): boolean {
        const fn = FeatureUnlock[feature];
        if (!fn) return true;
        return fn({ user: User, guide: Guide });
    }

    static getLockedHint(feature: FeatureValue): string {
        return FeatureHint[feature] || '功能未解锁';
    }

    static listLocked(): Array<{ feature: FeatureValue; hint: string }> {
        const out: Array<{ feature: FeatureValue; hint: string }> = [];
        for (const f of Object.values(Feature) as FeatureValue[]) {
            if (!FeatureUnlockManager.isUnlocked(f)) out.push({ feature: f, hint: FeatureHint[f] });
        }
        return out;
    }
}
