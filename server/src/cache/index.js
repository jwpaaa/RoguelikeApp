/**
 * Cache 抽象（KV + 简单发布订阅）
 * ---------------------------------------------------------------
 * 通常用于：
 *   - 在线用户会话 (token -> openid)
 *   - 房间到节点映射（多机部署时）
 *   - 排行榜缓存
 *   - 限流计数（生产建议用 Redis 原子计数）
 *
 * Memory 实现：单机够用；Redis 实现：可水平扩展。
 */

'use strict';

const { config } = require('../config');
const { Logger } = require('../util/Logger');

class MemoryCache {
    constructor() {
        /** @type {Map<string, { value:any, expireAt:number }>} */
        this.store = new Map();
        this._timer = setInterval(() => this._sweep(), 30000).unref();
    }

    async get(key) {
        const item = this.store.get(key);
        if (!item) return null;
        if (item.expireAt > 0 && item.expireAt < Date.now()) {
            this.store.delete(key);
            return null;
        }
        return item.value;
    }

    /** @param {number} [ttlSec] */
    async set(key, value, ttlSec) {
        this.store.set(key, {
            value,
            expireAt: ttlSec ? Date.now() + ttlSec * 1000 : 0,
        });
    }

    async del(key) { this.store.delete(key); }

    async incrBy(key, n) {
        const cur = (await this.get(key)) || 0;
        const next = Number(cur) + n;
        await this.set(key, next);
        return next;
    }

    /** ZSET 简化：用数组排序模拟 leaderboard */
    async zAdd(key, score, member) {
        const arr = (await this.get(key)) || [];
        const idx = arr.findIndex((x) => x.member === member);
        if (idx >= 0) arr[idx] = { score, member };
        else arr.push({ score, member });
        arr.sort((a, b) => b.score - a.score);
        await this.set(key, arr);
    }

    async zRange(key, start, stop) {
        const arr = (await this.get(key)) || [];
        return arr.slice(start, stop + 1);
    }

    async close() {
        clearInterval(this._timer);
        this.store.clear();
    }

    _sweep() {
        const now = Date.now();
        for (const [k, v] of this.store) if (v.expireAt > 0 && v.expireAt < now) this.store.delete(k);
    }
}

class RedisCache {
    constructor(client) { this.client = client; }

    async get(key) {
        const v = await this.client.get(key);
        if (!v) return null;
        try { return JSON.parse(v); } catch (_e) { return v; }
    }

    async set(key, value, ttlSec) {
        const s = typeof value === 'string' ? value : JSON.stringify(value);
        if (ttlSec) await this.client.set(key, s, 'EX', ttlSec);
        else await this.client.set(key, s);
    }

    async del(key) { await this.client.del(key); }

    async incrBy(key, n) {
        return Number(await this.client.incrby(key, n));
    }

    async zAdd(key, score, member) { await this.client.zadd(key, score, member); }

    async zRange(key, start, stop) {
        const arr = await this.client.zrevrange(key, start, stop, 'WITHSCORES');
        const out = [];
        for (let i = 0; i < arr.length; i += 2) out.push({ member: arr[i], score: Number(arr[i + 1]) });
        return out;
    }

    async close() { await this.client.quit(); }
}

/**
 * @returns {Promise<{ cache: any }>}
 */
async function createCache() {
    if (!config.redisUrl) {
        Logger.info('Cache', 'REDIS_URL not set, using in-memory cache');
        return { cache: new MemoryCache() };
    }
    let IORedis;
    try { IORedis = require('ioredis'); }
    catch (_e) {
        Logger.error('Cache', 'ioredis not installed, falling back to memory');
        return { cache: new MemoryCache() };
    }
    const client = new IORedis(config.redisUrl);
    await client.ping();
    Logger.info('Cache', 'Redis connected');
    return { cache: new RedisCache(client) };
}

module.exports = { createCache, MemoryCache, RedisCache };
