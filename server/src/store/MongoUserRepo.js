/**
 * 用户仓库（MongoDB 实现）
 * ---------------------------------------------------------------
 * 数据库设计文档对应 users 集合。索引：
 *   { openid: 1 } unique
 *   { bestWave: -1 }
 *   { bestScore: -1 }
 *
 * 仅当 `MONGO_URL` 已配置时被启用。
 */

'use strict';

const { IUserRepo } = require('./IUserRepo');
const { Logger } = require('../util/Logger');

class MongoUserRepo extends IUserRepo {
    /**
     * @param {object} mongoColl MongoDB 集合实例
     */
    constructor(mongoColl) {
        super();
        this.col = mongoColl;
    }

    /** 初始化索引（外部启动时调用） */
    static async ensureIndexes(col) {
        try {
            await col.createIndex({ openid: 1 }, { unique: true });
            await col.createIndex({ bestWave: -1 });
            await col.createIndex({ bestScore: -1 });
        } catch (e) {
            Logger.warn('MongoUserRepo', 'ensureIndexes failed', e.message);
        }
    }

    async getByOpenId(openid) {
        return this.col.findOne({ openid });
    }

    async upsert(record) {
        if (!record || !record.openid) throw new Error('bad_record');
        const now = Date.now();
        await this.col.updateOne(
            { openid: record.openid },
            {
                $set: Object.assign({}, record, { updatedAt: now }),
                $setOnInsert: { createdAt: now },
            },
            { upsert: true },
        );
    }

    async patch(openid, patch) {
        await this.col.updateOne(
            { openid },
            { $set: Object.assign({}, patch, { updatedAt: Date.now() }) },
        );
    }

    async findTop(field, limit) {
        return this.col.find({}).sort({ [field]: -1 }).limit(limit || 100).toArray();
    }
}

module.exports = { MongoUserRepo };
