/**
 * Toast 顶部提示气泡
 */

import { instance as UI } from '../core/UIManager';
import { UINode } from '../core/UINode';
import { Palette, FontSize, DesignResolution } from '../core/UIConst';
import { Logger } from '../../utils/Logger';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

const TYPE_COLOR: Record<ToastType, string | number> = {
    info:    Palette.PANEL_BG,
    success: '2ECC71E0',
    warning: 'F39C12E0',
    error:   'E74C3CE0',
};

interface QueueItem { text: string; opts: { duration: number; type: ToastType }; }

const _queue: QueueItem[] = [];
let _showing = false;

export class Toast {
    static show(text: string, opts?: { duration?: number; type?: ToastType }): void {
        const o = { duration: 2000, type: 'info' as ToastType, ...opts };
        _queue.push({ text, opts: o });
        if (!_showing) Toast._pump();
    }

    private static _pump(): void {
        if (_queue.length === 0) { _showing = false; return; }
        _showing = true;
        const { text, opts } = _queue.shift()!;
        Logger.debug('Toast', '[' + opts.type + ']', text);

        const layer = UI.getLayer('toast');
        if (!layer) { setTimeout(() => Toast._pump(), opts.duration); return; }

        const bg = UINode.panel({
            name: 'Toast',
            size: { w: 320, h: 160 },
            pos: { x: 0, y: DesignResolution.HEIGHT / 2 - 80 },
            color: TYPE_COLOR[opts.type] || TYPE_COLOR.info,
        });
        const { node: lblNode } = UINode.label({
            text,
            fontSize: FontSize.NORMAL,
            color: Palette.WHITE,
            size: { w: 300, h: 160 },
        });
        bg.addChild(lblNode);
        layer.addChild(bg);

        setTimeout(() => {
            bg.destroy();
            Toast._pump();
        }, opts.duration);
    }

    static info(text: string):    void { Toast.show(text, { type: 'info' }); }
    static success(text: string): void { Toast.show(text, { type: 'success' }); }
    static warn(text: string):    void { Toast.show(text, { type: 'warning' }); }
    static close(): void {
        _queue.length = 0;
        _showing = false;
    }
}
