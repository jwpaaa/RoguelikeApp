/**
 * 游戏入口（Game Root）
 * ---------------------------------------------------------------
 * 在 Cocos Creator 主场景节点上挂载本组件即可启动游戏。
 * Node.js 模拟器（tools/sim.ts）调用 GameRoot.bootHeadless() 跑无头逻辑。
 *
 * 职责：
 *   - 初始化 AuthManager、UserDataManager、GuideDataManager
 *   - 创建 BattleManager 并交给 TimeManager 驱动
 *   - 注册 onShareAppMessage（小游戏入口必须）
 */

import { instance as TimeManager } from './TimeManager';
import { instance as Auth }        from '../social/AuthManager';
import { instance as User }        from '../data/UserDataManager';
import { TalentDataManager }       from '../data/TalentDataManager';
import { ShareManager }            from '../social/ShareManager';
import { BattleManager }           from '../battle/BattleManager';
import { instance as NetworkClient } from '../network/NetworkClient';
import { OnlineBattleAdapter }     from '../network/OnlineBattleAdapter';
import { instance as EventBus }    from './EventBus';
import { Logger }                  from '../utils/Logger';
import { calcBattleExp }           from '../config/TalentConfig';
import type { DifficultyValue }    from '../config/DifficultyConfig';

declare const wx: undefined | {
    login: (opts: { success: (r: { code: string }) => void }) => void;
};

export interface BootHeadlessCfg {
    seed: number;
    difficulty: DifficultyValue;
    players: Array<{ id: string; name?: string }>;
    autoBuild?: boolean;
}

export interface OnlineBattleCfg {
    seed: number;
    difficulty: DifficultyValue;
    players: Array<{ id: string; name?: string; host?: boolean; isAi?: boolean }>;
    talentEffects?: Record<string, unknown>;
}

export class GameRoot {
    currentBattle: BattleManager | null = null;
    onlineAdapter: OnlineBattleAdapter | null = null;

    /** Cocos 端入口：在主场景 onLoad 里调用 */
    boot(): void {
        Logger.info('Boot', 'GameRoot boot');
        Auth.loginWithWx();
        ShareManager.register(() => ({ title: '一起来玩肉鸽塔防！', query: '' }));
        EventBus.on('battle_end', (r: any) => this._onBattleEnd(r));
    }

    /** 无头测试入口 */
    bootHeadless(cfg: BootHeadlessCfg): BattleManager {
        Auth.mockLogin();
        return this.startBattle(cfg);
    }

    /**
     * 联机入口：建连 + 登录
     */
    async bootOnline(cfg: { url: string; code?: string }): Promise<unknown> {
        Logger.info('Boot', 'bootOnline', cfg.url);
        await NetworkClient.connect(cfg.url);
        let realCode = cfg.code;
        if (!realCode && typeof wx !== 'undefined' && wx.login) {
            realCode = await new Promise<string>((resolve) => wx.login!({ success: (r) => resolve(r.code) }));
        }
        if (!realCode) realCode = 'mock_' + Date.now();
        const auth = await NetworkClient.login({ code: realCode, nickname: User.data.nickname, avatar: User.data.avatar });
        User.setProfile({ openid: auth.openid, nickname: auth.profile && (auth.profile as any).nickname });
        ShareManager.register(() => ({ title: '一起来玩肉鸽塔防！', query: '' }));
        EventBus.on('battle_end', (r: any) => this._onBattleEnd(r));
        return auth;
    }

    /** 创建一场新对局（单机） */
    startBattle(cfg: BootHeadlessCfg): BattleManager {
        const talentEffects = TalentDataManager.buildBattleEffects();
        const battle = new BattleManager({
            seed: cfg.seed,
            difficulty: cfg.difficulty,
            players: cfg.players,
            talentEffects,
        });
        this.currentBattle = battle;
        battle.startBattle();
        TimeManager.bind(battle);
        TimeManager.reset();
        return battle;
    }

    /** 联机开始战斗（由 RoomManager / Matchmaking 收到 battle_start 后调用） */
    startOnlineBattle(cfg: OnlineBattleCfg): BattleManager {
        const battle = new BattleManager({
            seed: cfg.seed,
            difficulty: cfg.difficulty,
            players: cfg.players,
            talentEffects: (cfg.talentEffects && (cfg.talentEffects as any)[NetworkClient.openid!]) || TalentDataManager.buildBattleEffects(),
            net: NetworkClient,
        });
        this.currentBattle = battle;
        this.onlineAdapter = new OnlineBattleAdapter({
            battle, net: NetworkClient,
            localPlayerId: NetworkClient.openid!,
        });
        battle.startBattle();
        TimeManager.bind(battle);
        TimeManager.reset();
        return battle;
    }

    private _onBattleEnd(result: { wave: number; kills: number; win: boolean; score: { score: number; grade: string } }): void {
        const exp = calcBattleExp({
            wave: result.wave,
            kills: result.kills,
            win: result.win,
            expMul: this.currentBattle ? (this.currentBattle as any).diff.expMul : 1,
        });
        User.addExp(exp);
        User.onBattleEnd({ wave: result.wave, score: result.score.score, grade: result.score.grade, win: result.win });
        Logger.info('Boot', 'battle finished, exp=', exp, 'level=', User.level);
    }
}

export const instance = new GameRoot();
