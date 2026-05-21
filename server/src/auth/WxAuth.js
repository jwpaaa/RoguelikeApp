/**
 * 微信 code2session（来自需求文档 §F-1.1）
 * ---------------------------------------------------------------
 * 拿 wx.login 返回的 code 去微信开放接口换 openid + session_key。
 * 本服务封装 HTTP 请求；当 WX_APP_ID 未配置时走 mock。
 */

'use strict';

const { config } = require('../config');
const { Logger } = require('../util/Logger');
const https = require('https');

/**
 * @param {string} code wx.login 返回的临时码
 * @returns {Promise<{ openid:string, sessionKey?:string, unionid?:string, mock?:boolean }>}
 */
async function code2session(code) {
    if (!config.wxAppId || !config.wxAppSecret) {
        Logger.warn('WxAuth', 'WX_APP_ID/SECRET not set, returning mock openid');
        return { openid: 'mock_' + (code || 'anon').slice(0, 12), mock: true };
    }
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(config.wxAppId)}&secret=${encodeURIComponent(config.wxAppSecret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                try {
                    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                    if (body.openid) resolve({ openid: body.openid, sessionKey: body.session_key, unionid: body.unionid });
                    else reject(new Error('wx_error: ' + JSON.stringify(body)));
                } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.setTimeout(5000, () => req.destroy(new Error('wx_timeout')));
    });
}

module.exports = { code2session };
