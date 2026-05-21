/**
 * 全局事件总线（发布/订阅）
 * ---------------------------------------------------------------
 * 用于解耦战斗模块、UI、社交、数据持久化各层。
 * 性能上：仅在低频事件（建塔/波次结算/UI 通知）使用，
 * 不要把 60Hz 的渲染数据放进事件总线。
 *
 * @example
 *   EventBus.on('wave_end', (waveNum) => { ... });
 *   EventBus.emit('wave_end', 5);
 *   EventBus.off('wave_end', handler);
 */

export type EventHandler = (...args: any[]) => void;

export class EventBus {
    private _map: Map<string, EventHandler[]>;

    constructor() {
        this._map = new Map();
    }

    /** 订阅事件，返回取消订阅函数 */
    on(event: string, handler: EventHandler): () => void {
        let list = this._map.get(event);
        if (!list) {
            list = [];
            this._map.set(event, list);
        }
        list.push(handler);
        return () => this.off(event, handler);
    }

    /** 一次性订阅 */
    once(event: string, handler: EventHandler): () => void {
        const wrap: EventHandler = (...args: unknown[]) => {
            this.off(event, wrap);
            handler(...args);
        };
        return this.on(event, wrap);
    }

    /**
     * 取消订阅
     * @param event
     * @param handler 不传则清空该 event
     */
    off(event: string, handler?: EventHandler): void {
        if (!this._map.has(event)) return;
        if (!handler) {
            this._map.delete(event);
            return;
        }
        const list = this._map.get(event)!;
        const idx = list.indexOf(handler);
        if (idx >= 0) list.splice(idx, 1);
        if (list.length === 0) this._map.delete(event);
    }

    /** 发出事件 */
    emit(event: string, ...args: unknown[]): void {
        const list = this._map.get(event);
        if (!list || list.length === 0) return;
        // 复制一份，防止订阅者在回调内修改订阅列表
        const copy = list.slice();
        for (const fn of copy) {
            try { fn(...args); }
            catch (e) { console.error('[EventBus]', event, e); }
        }
    }

    clear(): void { this._map.clear(); }
}

/** 全局单例 */
export const instance = new EventBus();

/** 兼容旧 require 风格的命名导出 */
export const EventBusInstance = instance;
export default instance;
