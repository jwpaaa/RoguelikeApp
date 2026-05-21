/**
 * 用户数据仓库（接口）
 * ---------------------------------------------------------------
 * 所有方法返回 Promise。MongoDB / Memory 实现需保持一致行为。
 *
 * @typedef {object} UserRecord
 * @property {string} openid           主键
 * @property {string} nickname
 * @property {string} avatar
 * @property {number} gold
 * @property {number} diamond
 * @property {number} exp
 * @property {number} bestWave
 * @property {number} bestScore
 * @property {string} bestGrade        'S'/'A'/'B'/'C'/'D'
 * @property {number} totalBattles
 * @property {number} totalWins
 * @property {Object<string,number>} talents  talentId -> level
 * @property {object} settings
 * @property {boolean} [realNameVerified]
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {number} [lastLoginAt]
 */

'use strict';

/* eslint-disable no-unused-vars */
class IUserRepo {
    /** @param {string} openid @returns {Promise<UserRecord|null>} */
    async getByOpenId(openid) { throw new Error('not_impl'); }

    /** @param {UserRecord} record @returns {Promise<void>} */
    async upsert(record) { throw new Error('not_impl'); }

    /** @param {string} openid @param {Partial<UserRecord>} patch @returns {Promise<void>} */
    async patch(openid, patch) { throw new Error('not_impl'); }

    /** @param {{ wave?:number, score?:number }} cond @returns {Promise<UserRecord[]>} */
    async findTop(field, limit) { throw new Error('not_impl'); }

    /** @returns {Promise<void>} */
    async close() {}
}
/* eslint-enable no-unused-vars */

module.exports = { IUserRepo };
