/**
 * 微信授权登录管理（来自需求文档 §F-1.1）
 */

import { instance as User } from '../data/UserDataManager';
import { instance as EventBus } from '../core/EventBus';

declare const wx: undefined | {
    login: (opts: { success: (r: { code: string }) => void; fail?: (e: unknown) => void }) => void;
    getUserProfile: (opts: { desc: string; success: (r: { userInfo: { nickName: string; avatarUrl: string } }) => void; fail?: (e: unknown) => void }) => void;
};

export interface AuthExchangeResult { token: string; openid: string; }
export type ExchangeFn = (code: string) => Promise<AuthExchangeResult>;

export class AuthManager {
    public token: string | null = null;
    public isGuest: boolean = false;

    static isWxEnv(): boolean {
        return typeof wx !== 'undefined' && typeof wx.login === 'function';
    }

    /** 微信一键登录 */
    async loginWithWx(exchangeFn?: ExchangeFn): Promise<boolean> {
        if (!AuthManager.isWxEnv()) {
            return this.mockLogin();
        }
        try {
            const code = await new Promise<string>((resolve, reject) => {
                wx!.login({
                    success: (r) => resolve(r.code),
                    fail: (e) => reject(e),
                });
            });
            const { token, openid } = exchangeFn
                ? await exchangeFn(code)
                : { token: 'mock', openid: 'wx_' + code.slice(0, 8) };
            this.token = token;
            User.setProfile({ openid });
            try {
                const profile = await new Promise<{ nickName: string; avatarUrl: string }>((resolve, reject) => {
                    wx!.getUserProfile({
                        desc: '用于完善用户资料',
                        success: (r) => resolve(r.userInfo),
                        fail: (e) => reject(e),
                    });
                });
                User.setProfile({ nickname: profile.nickName, avatar: profile.avatarUrl });
            } catch { /* 玩家拒绝头像 */ }
            EventBus.emit('auth_success', { openid, isGuest: false });
            return true;
        } catch {
            return this.loginAsGuest();
        }
    }

    /** 游客模式 */
    loginAsGuest(): boolean {
        this.isGuest = true;
        this.token = 'guest_' + Date.now();
        if (!User.data.openid) User.setProfile({ openid: this.token, nickname: '游客' + ((parseInt(this.token.slice(-4), 36)) | 0) });
        EventBus.emit('auth_success', { openid: User.data.openid, isGuest: true });
        return true;
    }

    mockLogin(): boolean {
        this.token = 'mock_' + Date.now();
        if (!User.data.openid) User.setProfile({ openid: this.token, nickname: '测试玩家' });
        EventBus.emit('auth_success', { openid: User.data.openid, isGuest: false });
        return true;
    }

    logout(): void {
        this.token = null;
        EventBus.emit('auth_logout');
    }
}

export const instance = new AuthManager();
