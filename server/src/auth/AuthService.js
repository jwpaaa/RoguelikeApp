/**
 * 登录处理器
 * ---------------------------------------------------------------
 * 接收 auth_login 请求 → wx.code2session → 写库 → 签 token → 返回。
 * 失败原因都用 ErrorCode.AUTH_FAIL 包装。
 */

'use strict';

const { Logger } = require('../util/Logger');
const { config } = require('../config');
const { signToken } = require('../util/Helpers');
const { code2session } = require('./WxAuth');

class AuthService {
    /** @param {import('../store/IUserRepo').IUserRepo} users */
    constructor(users) {
        this.users = users;
    }

    /**
     * @param {{ code:string, nickname?:string, avatar?:string }} data
     * @returns {Promise<{ openid:string, token:string, profile:object }>}
     */
    async login({ code, nickname, avatar }) {
        if (!code || typeof code !== 'string') throw new Error('missing_code');
        const session = await code2session(code);
        const openid = session.openid;

        // upsert 用户档案（首次登录初始化）
        let user = await this.users.getByOpenId(openid);
        if (!user) {
            user = {
                openid,
                nickname: nickname || '玩家',
                avatar: avatar || '',
                gold: 0, diamond: 0, exp: 0,
                bestWave: 0, bestScore: 0, bestGrade: 'D',
                totalBattles: 0, totalWins: 0,
                talents: {}, settings: {},
                createdAt: Date.now(),
                updatedAt: Date.now(),
                lastLoginAt: Date.now(),
            };
            await this.users.upsert(user);
        } else {
            const patch = { lastLoginAt: Date.now() };
            if (nickname && nickname !== user.nickname) patch.nickname = nickname;
            if (avatar   && avatar   !== user.avatar)   patch.avatar = avatar;
            await this.users.patch(openid, patch);
            user = Object.assign(user, patch);
        }

        const token = signToken({ openid }, config.jwtSecret);
        Logger.info('Auth', 'login', openid, session.mock ? '(mock)' : '');
        return {
            openid,
            token,
            profile: {
                nickname: user.nickname, avatar: user.avatar,
                gold: user.gold, diamond: user.diamond, exp: user.exp,
                bestWave: user.bestWave, bestScore: user.bestScore, bestGrade: user.bestGrade,
                totalBattles: user.totalBattles, totalWins: user.totalWins,
                talents: user.talents,
            },
        };
    }
}

module.exports = { AuthService };
