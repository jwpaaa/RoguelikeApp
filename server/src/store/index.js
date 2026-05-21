/**
 * Repository 工厂
 * ---------------------------------------------------------------
 * 根据 config.mongoUrl 决定使用 Mongo 还是 Memory 实现。
 * 调用方只关心接口，不关心后端。
 */

'use strict';

const { config } = require('../config');
const { Logger } = require('../util/Logger');
const { MemoryUserRepo } = require('./MemoryUserRepo');

/**
 * @returns {Promise<{ users: import('./IUserRepo').IUserRepo, close: () => Promise<void> }>}
 */
async function createRepos() {
    if (!config.mongoUrl) {
        Logger.info('Repo', 'MONGO_URL not set, using in-memory repos');
        const users = new MemoryUserRepo();
        return { users, close: async () => {} };
    }

    let MongoClient;
    try { ({ MongoClient } = require('mongodb')); }
    catch (e) {
        Logger.error('Repo', 'mongodb not installed, falling back to in-memory');
        const users = new MemoryUserRepo();
        return { users, close: async () => {} };
    }

    const { MongoUserRepo } = require('./MongoUserRepo');
    const client = new MongoClient(config.mongoUrl, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    const db = client.db(config.mongoDb);
    const usersCol = db.collection('users');
    await MongoUserRepo.ensureIndexes(usersCol);
    const users = new MongoUserRepo(usersCol);
    Logger.info('Repo', 'MongoDB connected:', config.mongoDb);

    return { users, close: async () => { await client.close(); } };
}

module.exports = { createRepos };
