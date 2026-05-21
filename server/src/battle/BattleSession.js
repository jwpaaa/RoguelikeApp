/**
 * 房间内战斗会话（服务端权威简化版）
 * ---------------------------------------------------------------
 * 职责（来自需求文档 §F-4.1 / §F-3.1 / §F-3.3）：
 *
 *   1) 房主点击开始 → 下发 battle_start { seed, difficulty, players, talentEffects }
 *      所有客户端基于同一 seed 派生地图/怪物/塔成长等"确定性随机"
 *   2) 玩家操作（建塔/升级/出售/换目标/用道具/购买商店）以 frame_input 上报
 *      → 服务端按 logicFrameId 转发给同房其他玩家（含本人）
 *      → 客户端按帧应用，保证一致
 *   3) 服务端独立真随机产生 dice_result 和 gacha_result，下发给玩家
 *      （客户端不主动算这两件事）
 *   4) 状态哈希校验：每 N 波结束，玩家上报本地状态摘要，
 *      服务端比对，多数派 vs 少数派 → 少数派被踢回重连流程
 *   5) 战斗结束 → game_over，更新存档
 *
 * 帧节奏：logicFrame = 15fps（66ms）。服务端不真正跑战斗逻辑，
 *        只在每个 logicFrame 把"收到的输入"打包广播。
 */

'use strict';

const { Logger } = require('../util/Logger');
const { MessageType } = require('../shared/MessageTypes');
const { config } = require('../config');
const { DiceServer } = require('./DiceServer');
const { GachaServer } = require('./GachaServer');

const LOGIC_FPS = 15;
const LOGIC_DT_MS = Math.floor(1000 / LOGIC_FPS);

class BattleSession {
    /**
     * @param {object} ctx
     * @param {import('../room/Room').Room} ctx.room
     * @param {import('../room/RoomManager').RoomManager} ctx.roomManager
     * @param {import('../store/IUserRepo').IUserRepo} ctx.users
     * @param {GachaServer} ctx.gachaServer
     */
    constructor(ctx) {
        this.room = ctx.room;
        this.roomManager = ctx.roomManager;
        this.users = ctx.users;
        this.gacha = ctx.gachaServer;

        this.logicFrame = 0;
        /** Map<frameId, Map<openid, Action[]>> */
        this.pendingInputs = new Map();
        /** 当前帧已收到输入的玩家集合 */
        this.curFrameInputs = new Map();

        /** 玩家累计击杀/分数（服务端维护以判断胜负 / 排行榜） */
        this.playerStats = new Map();
        for (const p of this.room.players) this.playerStats.set(p.openid, { kills: 0, gold: 0 });

        /** 已抽到的 unique 卡（防止反复 refund 不一致） */
        this.gachaOwned = new Map(); // openid → Set<id>

        /** 状态哈希校验：waveNumber → Map<openid, hash> */
        this.stateHashes = new Map();

        /** 玩家天赋汇总缓存：openid → { diceGoodPct, srBonus, ... } */
        this._talentCache = new Map();

        this._tickTimer = null;
        this._disposed = false;
        this.startedAt = 0;
    }

    /** 开始战斗 */
    async start() {
        this.startedAt = Date.now();
        this.room.state = 'IN_BATTLE';
        this.room.startedAt = this.startedAt;

        // 预加载每位玩家的天赋（影响骰子好运率、抽卡 SR 加成等）
        for (const p of this.room.players) {
            if (p.isAi) continue;
            try {
                const u = await this.users.getByOpenId(p.openid);
                if (u && u.talents) this._talentCache.set(p.openid, this._summarizeTalents(u.talents));
            } catch (_e) {}
        }

        const startMsg = {
            type: MessageType.BATTLE_START,
            timestamp: this.startedAt,
            data: {
                seed: this.room.seed,
                difficulty: this.room.difficulty,
                players: this.room.players.map((p) => ({ id: p.openid, name: p.name, host: p.host, isAi: !!p.isAi })),
                logicFps: LOGIC_FPS,
                // 把每位玩家的天赋效果一并下发，让客户端 BattleManager 同步应用
                talentEffects: this._exportTalentEffects(),
            },
        };
        this.roomManager.sendToRoom(this.room, startMsg);
        this._tickTimer = setInterval(() => this._tick(), LOGIC_DT_MS);
        Logger.info('Battle', 'started', this.room.roomId);
    }

    /** 玩家上报本帧输入（同步） */
    onFrameInput(openid, frameId, actions) {
        if (this._disposed) return;
        if (!this.curFrameInputs.has(openid)) this.curFrameInputs.set(openid, actions || []);
        // 单帧内允许追加输入（仅取首次以防作弊）
    }

    /** 每 66ms：打包当前帧所有玩家的输入并广播 */
    _tick() {
        const frameId = this.logicFrame++;
        const inputs = {};
        for (const p of this.room.players) {
            inputs[p.openid] = this.curFrameInputs.get(p.openid) || [{ type: 'EMPTY' }];
        }
        this.curFrameInputs.clear();
        const msg = {
            type: MessageType.FRAME_BROADCAST,
            timestamp: Date.now(),
            data: { frameId, inputs, serverTime: Date.now() },
        };
        this.roomManager.sendToRoom(this.room, msg);
    }

    /** 客户端在波次结束时请求服务端骰子结果 */
    rollDice(openid, waveNumber) {
        const allies = this.room.players.map((p) => p.openid).filter((id) => id !== openid);
        const result = DiceServer.roll({
            goodChance: this._getGoodChance(openid),
            reducedPositive: this.room.difficulty === 3,
            allyIds: allies,
        });
        const msg = {
            type: MessageType.DICE_RESULT,
            timestamp: Date.now(),
            data: { playerId: openid, waveNumber, ...result },
        };
        this.roomManager.sendToRoom(this.room, msg);
        return result;
    }

    /** 抽卡 */
    async drawGacha(openid, waveNumber) {
        const ownedSet = this.gachaOwned.get(openid) || new Set();
        const talent = this._talentCache.get(openid) || {};
        const r = await this.gacha.draw({
            openid,
            srBonus: talent.srBonus || 0,
            ownedIds: Array.from(ownedSet),
        });
        if (r.card.unique && r.refundedGold === 0) ownedSet.add(r.card.id);
        this.gachaOwned.set(openid, ownedSet);
        const msg = {
            type: MessageType.GACHA_RESULT,
            timestamp: Date.now(),
            data: { playerId: openid, waveNumber, ...r },
        };
        this.roomManager.sendToRoom(this.room, msg);
        return r;
    }

    /**
     * 玩家上报本地状态哈希（每 3 波）
     * 服务端用多数派比对：若该玩家与多数派不一致 → 踢回追帧流程
     */
    reportStateHash(openid, waveNumber, hash) {
        if (!this.stateHashes.has(waveNumber)) this.stateHashes.set(waveNumber, new Map());
        const bucket = this.stateHashes.get(waveNumber);
        bucket.set(openid, hash);
        // 仅当全员上报后判定
        if (bucket.size < this.room.players.length) return;
        const counts = new Map();
        for (const h of bucket.values()) counts.set(h, (counts.get(h) || 0) + 1);
        let majorityHash = null;
        let maxCnt = 0;
        for (const [h, c] of counts) if (c > maxCnt) { maxCnt = c; majorityHash = h; }
        for (const [openid2, h] of bucket) {
            if (h !== majorityHash) {
                Logger.warn('Battle', 'desync', this.room.roomId, openid2, 'wave', waveNumber);
                const connId = this.room.openidToConn.get(openid2);
                if (connId) {
                    this.roomManager.ws.broadcast([connId], {
                        type: MessageType.STATE_DESYNC,
                        timestamp: Date.now(),
                        data: { waveNumber, action: 'rejoin' },
                    });
                }
            }
        }
    }

    /** 结算（房主上报结果） */
    async settle(result) {
        if (this._disposed) return;
        const msg = {
            type: MessageType.GAME_OVER,
            timestamp: Date.now(),
            data: result,
        };
        this.roomManager.sendToRoom(this.room, msg);

        // 防刷规则（来自需求 §F-5.4）
        const realPlayers = this.room.players.filter((p) => !p.isAi);
        const hasAi  = this.room.players.some((p) => p.isAi);
        const isMP   = realPlayers.length >= 2;
        const battleDurationMs = this.startedAt > 0 ? (Date.now() - this.startedAt) : 0;
        const tooShort = battleDurationMs < 3 * 60 * 1000;
        // 联机排行榜资格：≥ 2 真人 + 无 AI 队友 + 时长 ≥ 3min
        const eligibleForLeaderboard = isMP && !hasAi && !tooShort;

        // 写入每个玩家档案
        for (const p of realPlayers) {
            try {
                const u = await this.users.getByOpenId(p.openid);
                if (!u) continue;
                const patch = {
                    totalBattles: (u.totalBattles || 0) + 1,
                    totalWins:    (u.totalWins || 0) + (result.win ? 1 : 0),
                };
                // 个人最佳（不限联机/单机，但仅记录"达标"对局）
                if (!tooShort) {
                    if (result.wave > (u.bestWave || 0)) patch.bestWave = result.wave;
                    if (result.score && result.score.score > (u.bestScore || 0)) {
                        patch.bestScore = result.score.score;
                        patch.bestGrade = result.score.grade;
                    }
                }
                // 排行榜：检查每日上榜次数
                if (eligibleForLeaderboard) {
                    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
                    const lbKey = `lbDaily.${today}`;
                    const usedToday = (u[lbKey] || 0) + 1;
                    if (usedToday <= 1) {
                        patch[lbKey] = usedToday;
                        patch.lastLeaderboardTs = Date.now();
                    }
                    // 超过当日 1 次仍写 totalBattles，但不进 bestWave/bestScore
                }
                await this.users.patch(p.openid, patch);
            } catch (e) { Logger.error('Battle', 'settle persist', e.message); }
        }
        this.dispose();
    }

    dispose() {
        if (this._disposed) return;
        this._disposed = true;
        if (this._tickTimer) { clearInterval(this._tickTimer); this._tickTimer = null; }
        this.room.state = 'FINISHED';
        this.room.endedAt = Date.now();
        Logger.info('Battle', 'disposed', this.room.roomId);
    }

    _getGoodChance(openid) {
        const base = this.room.difficulty === 1 ? 0.55 : (this.room.difficulty === 3 ? 0.45 : 0.50);
        const t = this._talentCache.get(openid) || {};
        return base + (t.diceGoodPct || 0);
    }

    /**
     * 把玩家的天赋点等级表汇总成"对战斗有用的修正"
     * 与客户端 TalentDataManager.buildBattleEffects 保持对齐
     */
    _summarizeTalents(talents) {
        const out = {
            globalAtkPct: 0, globalCritPct: 0, startGold: 0, crystalHp: 0,
            buildDiscount: 0, shieldBonus: 0,
            diceGoodPct: 0, srBonus: 0, allyDebuffResist: 0,
            unlockTargetMode: false,
        };
        // 等级 → 数值，硬编码与客户端 TalentConfig 一致
        const dict = {
            A1: [0.05, 0.10, 0.15],  // GLOBAL_ATK_PCT
            A2: [0.03, 0.06, 0.10],  // GLOBAL_CRIT
            A3: [50, 100, 200],      // START_GOLD
            A4: [1],                 // UNLOCK_TARGET_MODE
            D1: [1, 2, 3],           // CRYSTAL_HP
            D2: [0.05, 0.10, 0.15],  // BUILD_DISCOUNT
            D3: [1, 2],              // SHIELD_BONUS
            L1: [0.05, 0.10, 0.15],  // DICE_GOOD_PCT
            L2: [0.02, 0.04],        // GACHA_SR_PCT
            L3: [0.10, 0.20, 0.30],  // ALLY_DEBUFF_RESIST
        };
        const mapKey = {
            A1: 'globalAtkPct', A2: 'globalCritPct', A3: 'startGold', A4: 'unlockTargetMode',
            D1: 'crystalHp', D2: 'buildDiscount', D3: 'shieldBonus',
            L1: 'diceGoodPct', L2: 'srBonus', L3: 'allyDebuffResist',
        };
        for (const [tid, lv] of Object.entries(talents || {})) {
            const arr = dict[tid];
            if (!arr || !lv) continue;
            const v = arr[Math.min(lv, arr.length) - 1];
            const k = mapKey[tid];
            if (k === 'unlockTargetMode') out[k] = !!v;
            else out[k] = (out[k] || 0) + v;
        }
        return out;
    }

    /** 导出全部玩家的 talentEffects，用于 battle_start 下发 */
    _exportTalentEffects() {
        const out = {};
        for (const [openid, t] of this._talentCache) out[openid] = t;
        return out;
    }
}

module.exports = { BattleSession, LOGIC_FPS, LOGIC_DT_MS };
