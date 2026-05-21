/**
 * 服务端通用工具：ID、Hash、限流、JWT、SeededRandom
 * ---------------------------------------------------------------
 * 服务端的 SeededRandom 与客户端逻辑保持一致（Mulberry32），用于
 * 让"客户端可复算"的随机（地图种子）服务端先生成。
 */

'use strict';

const crypto = require('crypto');

let _idSeq = 1;
function nextId(prefix) {
    _idSeq = (_idSeq + 1) | 0;
    return `${prefix || 'id'}_${Date.now().toString(36)}_${_idSeq.toString(36)}`;
}

/** 6 位房间号（数字） */
function newRoomCode() {
    return String(100000 + Math.floor(Math.random() * 900000));
}

/** 32 位整数随机种子 */
function newSeed() {
    return crypto.randomBytes(4).readInt32BE(0);
}

/** 真随机：从数组里加权选 1 */
function pickWeightedReal(items, weights) {
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += weights[i];
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r < 0) return items[i];
    }
    return items[items.length - 1];
}

/** 取数组随机 n 个不重复 */
function pickNReal(arr, n) {
    const pool = arr.slice();
    const out = [];
    const c = Math.min(n, pool.length);
    for (let i = 0; i < c; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        out.push(pool[idx]);
        pool.splice(idx, 1);
    }
    return out;
}

/** HMAC-SHA256 摘要 → 16 进制字符串 */
function hmac(secret, text) {
    return crypto.createHmac('sha256', secret).update(String(text)).digest('hex');
}

/**
 * 简易 JWT（HS256 风格但避免引入库）
 * payload + 签名拼字符串：base64url(payload).hmac
 */
function signToken(payload, secret) {
    const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString('base64url');
    return body + '.' + hmac(secret, body);
}

function verifyToken(token, secret) {
    if (!token || typeof token !== 'string') return null;
    const idx = token.indexOf('.');
    if (idx < 0) return null;
    const body = token.slice(0, idx);
    const sig  = token.slice(idx + 1);
    if (hmac(secret, body) !== sig) return null;
    try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); }
    catch (_e) { return null; }
}

/** 滑动窗口限流：windowMs 内最多 max 次 */
class RateLimiter {
    constructor(windowMs, max) {
        this.windowMs = windowMs;
        this.max = max;
        /** Map<key, number[]> 时间戳列表 */
        this.map = new Map();
    }
    /** @returns {boolean} 是否允许 */
    take(key) {
        const now = Date.now();
        const arr = this.map.get(key) || [];
        const valid = arr.filter((ts) => now - ts < this.windowMs);
        if (valid.length >= this.max) {
            this.map.set(key, valid);
            return false;
        }
        valid.push(now);
        this.map.set(key, valid);
        return true;
    }
    reset(key) { this.map.delete(key); }
}

module.exports = { nextId, newRoomCode, newSeed, pickWeightedReal, pickNReal, hmac, signToken, verifyToken, RateLimiter };
