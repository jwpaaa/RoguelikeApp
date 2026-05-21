/**
 * 用户仓库（内存实现，零依赖默认）
 * ---------------------------------------------------------------
 * 进程重启即丢失，仅用于开发/测试与单机部署。
 */

'use strict';

const { IUserRepo } = require('./IUserRepo');

class MemoryUserRepo extends IUserRepo {
    constructor() {
        super();
        /** @type {Map<string, UserRecord>} */
        this.store = new Map();
    }

    async getByOpenId(openid) {
        return this.store.get(openid) || null;
    }

    async upsert(record) {
        if (!record || !record.openid) throw new Error('bad_record');
        const old = this.store.get(record.openid);
        const next = Object.assign({}, old || {}, record, {
            updatedAt: Date.now(),
            createdAt: old ? old.createdAt : Date.now(),
        });
        this.store.set(record.openid, next);
    }

    async patch(openid, patch) {
        const cur = this.store.get(openid);
        if (!cur) return;
        const next = Object.assign({}, cur, patch, { updatedAt: Date.now() });
        this.store.set(openid, next);
    }

    async findTop(field, limit) {
        const arr = Array.from(this.store.values());
        arr.sort((a, b) => (b[field] || 0) - (a[field] || 0));
        return arr.slice(0, limit || 100);
    }
}

module.exports = { MemoryUserRepo };
