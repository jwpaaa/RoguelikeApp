/**
 * 跨端存储抽象（微信小游戏 wx.* / 浏览器 localStorage / Node 内存）
 * ---------------------------------------------------------------
 * 让 data 层不必关心运行环境：
 *   - 微信小游戏：wx.setStorageSync / wx.getStorageSync
 *   - 浏览器/H5：window.localStorage
 *   - Node 测试：内存 Map（重启即丢）
 */

// 全局类型声明（避免引入 wx 类型包）
declare const wx: undefined | {
    getStorageSync: (key: string) => unknown;
    setStorageSync: (key: string, value: unknown) => void;
    removeStorageSync: (key: string) => void;
};

export interface IStorageImpl {
    get(key: string): unknown;
    set(key: string, value: unknown): boolean;
    remove(key: string): void;
}

function createImpl(): IStorageImpl {
    // 1. 微信小游戏
    if (typeof wx !== 'undefined' && typeof wx.getStorageSync === 'function') {
        return {
            get(key) {
                try {
                    const v = wx.getStorageSync(key);
                    return v === '' ? null : v;
                } catch { return null; }
            },
            set(key, value) {
                try { wx.setStorageSync(key, value); return true; } catch { return false; }
            },
            remove(key) { try { wx.removeStorageSync(key); } catch { /* swallow */ } },
        };
    }
    // 2. 浏览器 H5
    if (typeof window !== 'undefined' && window.localStorage) {
        return {
            get(key) {
                const v = window.localStorage.getItem(key);
                try { return v ? JSON.parse(v) : null; } catch { return v; }
            },
            set(key, value) {
                try { window.localStorage.setItem(key, JSON.stringify(value)); return true; }
                catch { return false; }
            },
            remove(key) { window.localStorage.removeItem(key); },
        };
    }
    // 3. Node 测试：内存
    const mem = new Map<string, unknown>();
    return {
        get(key)        { return mem.has(key) ? mem.get(key) : null; },
        set(key, value) { mem.set(key, value); return true; },
        remove(key)     { mem.delete(key); },
    };
}

const _impl = createImpl();

export const Storage = {
    get:    (key: string): unknown               => _impl.get(key),
    set:    (key: string, value: unknown): boolean => _impl.set(key, value),
    remove: (key: string): void                    => _impl.remove(key),
};
