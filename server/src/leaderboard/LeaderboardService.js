/**
 * 排行榜（来自需求文档 §F-5.4）
 * ---------------------------------------------------------------
 * 4 个维度：
 *   - bestWave    最高通关波次
 *   - bestScore   最高综合评分
 *   - bestTime    最快通关时间（值越小越好；本服存为负数让 zset 通用化）
 *   - kills       击杀总数
 *
 * 排行榜每 30 分钟整体刷新一次（异步任务），实时查询时直接读 cache。
 * 防刷：本服务仅记录"合法对局结果"，
 *      - 联机至少 2 人、AI 队友不计入、通关时长 > 3 min 等过滤由调用方判断
 */

'use strict';

const { Logger } = require('../util/Logger');

const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

class LeaderboardService {
    /** @param {{ users:import('../store/IUserRepo').IUserRepo, cache:any }} ctx */
    constructor(ctx) {
        this.users = ctx.users;
        this.cache = ctx.cache;
        this._timer = null;
    }

    start() {
        this.refreshAll().catch((e) => Logger.error('Lb', 'init refresh', e.message));
        this._timer = setInterval(() => {
            this.refreshAll().catch((e) => Logger.error('Lb', 'refresh', e.message));
        }, REFRESH_INTERVAL_MS).unref();
    }

    stop() { if (this._timer) clearInterval(this._timer); }

    /**
     * @param {string} field 'bestWave' / 'bestScore' / 'totalWins'
     * @param {number} [limit=100]
     * @param {number} [offset=0]
     */
    async getTop(field, limit, offset) {
        const _limit  = limit  || 100;
        const _offset = offset || 0;
        const cacheKey = 'lb:' + field;
        let cached = await this.cache.get(cacheKey);
        if (!cached) {
            const list = await this.users.findTop(field, 500);
            cached = list.map((u, i) => ({
                rank: i + 1, openid: u.openid, nickname: u.nickname, avatar: u.avatar, value: u[field] || 0,
            }));
            await this.cache.set(cacheKey, cached, 60 * 5);
        }
        return cached.slice(_offset, _offset + _limit);
    }

    /** 异步刷新所有维度（30 分钟一次） */
    async refreshAll() {
        for (const field of ['bestWave', 'bestScore', 'totalWins']) {
            const list = await this.users.findTop(field, 100);
            const trimmed = list.map((u, i) => ({
                rank: i + 1, openid: u.openid, nickname: u.nickname, avatar: u.avatar, value: u[field] || 0,
            }));
            await this.cache.set('lb:' + field, trimmed, 60 * 30);
        }
        Logger.info('Lb', 'refreshed');
    }

    /** 我在某榜中的排名（粗略：从 top 100 找；不在内就显示"100+"） */
    async getMyRank(field, openid) {
        const list = await this.getTop(field, 100);
        const me = list.find((x) => x.openid === openid);
        return me || { rank: -1, openid };
    }
}

module.exports = { LeaderboardService };
