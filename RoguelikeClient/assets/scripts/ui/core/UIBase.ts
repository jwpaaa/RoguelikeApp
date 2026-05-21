/**
 * UI 基类（生命周期 + EventBus 订阅自动注销）
 */

import { instance as EventBus } from '../../core/EventBus';
import type { cc } from './CocosAdapter';

interface Subscription {
    event: string;
    handler: (...args: unknown[]) => void;
}

export class UIBase {
    public node: cc.Node | null;
    private _subs: Subscription[] = [];
    private _shown: boolean = false;

    constructor(ctx?: { node?: cc.Node | null }) {
        this.node = (ctx && ctx.node) || null;
    }

    /** 订阅事件并自动登记 */
    listen(event: string, handler: (...args: unknown[]) => void): void {
        EventBus.on(event, handler);
        this._subs.push({ event, handler });
    }

    show(): void {
        if (this._shown) return;
        this._shown = true;
        if (this.node) this.node.active = true;
        if (typeof this.onShow === 'function') this.onShow();
    }

    hide(): void {
        if (!this._shown) return;
        this._shown = false;
        if (this.node) this.node.active = false;
        if (typeof this.onHide === 'function') this.onHide();
    }

    destroy(): void {
        for (const s of this._subs) EventBus.off(s.event, s.handler);
        this._subs.length = 0;
        if (typeof this.onDestroy === 'function') this.onDestroy();
        if (this.node) this.node.destroy();
        this.node = null;
    }

    isShown(): boolean { return this._shown; }

    /** 子类可覆盖 */
    onShow():    void {}
    onHide():    void {}
    onDestroy(): void {}
}
