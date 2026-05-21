/**
 * 微信内容安全审核（来自需求文档 §F-1.6 + §11 安全合规）
 * ---------------------------------------------------------------
 * 调用 https://api.weixin.qq.com/wxa/msg_sec_check（v2 接口）
 * 返回 errcode === 0 表示内容安全；其他视为违规。
 *
 * access_token 自动缓存（约 7200s 过期），过期前 5 分钟刷新。
 */

'use strict';

const https = require('https');
const { config } = require('../config');
const { Logger } = require('./Logger');

let _accessToken = null;
let _tokenExpireAt = 0;

const TOKEN_URL_FMT = 'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=%s&secret=%s';

/** 获取 access_token（带缓存） */
async function getAccessToken() {
    const now = Date.now();
    if (_accessToken && now < _tokenExpireAt) return _accessToken;
    if (!config.wxAppId || !config.wxAppSecret) {
        // 未配置 → 跳过审核（开发环境）
        return null;
    }
    const url = TOKEN_URL_FMT
        .replace('%s', encodeURIComponent(config.wxAppId))
        .replace('%s', encodeURIComponent(config.wxAppSecret));
    return new Promise((resolve) => {
        https.get(url, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                try {
                    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                    if (body.access_token) {
                        _accessToken = body.access_token;
                        _tokenExpireAt = now + (body.expires_in - 300) * 1000;
                        Logger.info('WxSec', 'token refreshed');
                        resolve(_accessToken);
                    } else {
                        Logger.warn('WxSec', 'token error', body);
                        resolve(null);
                    }
                } catch (e) { Logger.error('WxSec', 'token parse', e.message); resolve(null); }
            });
        }).on('error', (e) => { Logger.error('WxSec', 'token fail', e.message); resolve(null); });
    });
}

/**
 * 审核文本内容
 * @param {string} text 待审核文本
 * @param {string} openid 用户 openid（必填）
 * @returns {Promise<{ pass:boolean, reason?:string }>}
 */
async function checkText(text, openid) {
    if (!text || text.length === 0) return { pass: true };
    const token = await getAccessToken();
    if (!token) {
        // 开发环境无 token → 用本地兜底词库
        return localFallback(text);
    }
    const payload = {
        version: 2,
        openid: openid || 'unknown',
        scene: 1, // 1 资料；2 评论；3 论坛；4 社交日志
        content: text,
    };
    return new Promise((resolve) => {
        const url = 'https://api.weixin.qq.com/wxa/msg_sec_check?access_token=' + token;
        const data = JSON.stringify(payload);
        const u = new URL(url);
        const req = https.request({
            hostname: u.hostname,
            path: u.pathname + u.search,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
        }, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                try {
                    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                    if (body.errcode === 0) {
                        const result = body.result || {};
                        if (result.suggest === 'pass') {
                            resolve({ pass: true });
                        } else {
                            resolve({ pass: false, reason: result.label || result.suggest || 'risky' });
                        }
                    } else {
                        Logger.warn('WxSec', 'msgSecCheck error', body);
                        // 失败时不阻断业务，但兜底词库再过一遍
                        resolve(localFallback(text));
                    }
                } catch (e) {
                    Logger.error('WxSec', 'response parse', e.message);
                    resolve(localFallback(text));
                }
            });
        });
        req.on('error', (e) => {
            Logger.error('WxSec', 'request fail', e.message);
            resolve(localFallback(text));
        });
        req.setTimeout(3000, () => req.destroy(new Error('wx_sec_timeout')));
        req.write(data);
        req.end();
    });
}

/** 本地兜底词库（仅开发环境/网络失败时用） */
const LOCAL_DENY = ['admin', 'fuck', 'shit', /* 实际项目应有更完整词库 */];

function localFallback(text) {
    const lc = text.toLowerCase();
    for (const w of LOCAL_DENY) {
        if (lc.indexOf(w) >= 0) return { pass: false, reason: 'local_deny' };
    }
    return { pass: true };
}

module.exports = { checkText, getAccessToken };
