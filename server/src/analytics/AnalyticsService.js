/**
 * 服务端埋点接收（来自需求文档 §11）
 * ---------------------------------------------------------------
 * 接收客户端 batch 上报，写入 MongoDB events 集合或直接落本地日志。
 * 防刷：单连接 1 秒最多 50 条 / 单批 max 50 条；超量丢弃。
 *
 * 字段（按文档 §11.5 命名 rtd_*）：
 *   { event_name, timestamp, session_id, player_id, data }
 */

'use strict';

const { Logger } = require('../util/Logger');
const { RateLimiter } = require('../util/Helpers');

const BATCH_MAX = 50;
const RATE_WINDOW_MS = 1000;
const RATE_MAX = 50;

class AnalyticsService {
    /** @param {{ users?:any, cache?:any, mongoDb?:any }} ctx */
    constructor(ctx) {
        this.mongoEvents = (ctx && ctx.mongoDb) ? ctx.mongoDb.collection('events') : null;
        this.limiter = new RateLimiter(RATE_WINDOW_MS, RATE_MAX);
    }

    /**
     * @param {string} openid
     * @param {Array} events
     */
    async ingest(openid, events) {
        if (!Array.isArray(events) || events.length === 0) return { count: 0 };
        if (events.length > BATCH_MAX) events = events.slice(0, BATCH_MAX);
        if (!this.limiter.take(openid)) {
            Logger.warn('Analytics', 'rate_limited', openid);
            return { count: 0 };
        }
        // 强制覆盖 player_id（防伪造）
        for (const e of events) {
            e.player_id = openid;
            if (!e.timestamp) e.timestamp = Date.now();
            if (!e.event_name) e.event_name = 'rtd_unknown';
        }
        if (this.mongoEvents) {
            try { await this.mongoEvents.insertMany(events, { ordered: false }); }
            catch (e) { Logger.error('Analytics', 'mongo insert', e.message); }
        } else {
            // 无 Mongo → 仅 DEBUG 日志
            for (const e of events) Logger.debug('Analytics', e.event_name, JSON.stringify(e.data || {}));
        }
        return { count: events.length };
    }
}

module.exports = { AnalyticsService };
