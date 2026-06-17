import { instance as UI } from '../core/UIManager';
import { UINode } from '../core/UINode';
import { Palette, FontSize, DesignResolution } from '../core/UIConst';
import { Logger } from '../../utils/Logger';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastOpts {
    duration?: number;
    type?: ToastType;
    sizeW?: number;
    sizeH?: number;
}

const TYPE_COLOR: Record<ToastType, string | number> = {
    info:    Palette.PANEL_BG,
    success: '2ECC71E0',
    warning: 'F39C12E0',
    error:   'E74C3CE0',
};

let _currentBg: any = null;
let _timer: any = null;

export class Toast {
    static show(text: string, opts?: ToastOpts): void {
        const o = { duration: 2000, type: 'info' as ToastType, sizeW: 520, sizeH: 60, ...opts };
        const labelW = o.sizeW - 20;

        if (_timer) clearTimeout(_timer);
        if (_currentBg) _currentBg.destroy();

        const layer = UI.getLayer('toast');
        if (!layer) return;

        const bg = UINode.panel({
            name: 'Toast',
            size: { w: o.sizeW, h: o.sizeH },
            pos: { x: 0, y: DesignResolution.HEIGHT / 2 - 80 },
            color: TYPE_COLOR[o.type] || TYPE_COLOR.info,
        });
        const { node: lblNode } = UINode.label({
            text,
            fontSize: FontSize.NORMAL,
            color: Palette.WHITE,
            size: { w: labelW, h: o.sizeH },
        });
        bg.addChild(lblNode);
        layer.addChild(bg);
        _currentBg = bg;

        _timer = setTimeout(() => {
            bg.destroy();
            _currentBg = null;
            _timer = null;
        }, o.duration);

        Logger.debug('Toast', '[' + o.type + ']', text);
    }

    static close(): void {
        if (_timer) clearTimeout(_timer);
        if (_currentBg) _currentBg.destroy();
        _currentBg = null;
        _timer = null;
    }

    static info(text: string):    void { Toast.show(text, { type: 'info' }); }
    static success(text: string): void { Toast.show(text, { type: 'success' }); }
    static warn(text: string):    void { Toast.show(text, { type: 'warning' }); }
    static error(text: string):   void { Toast.show(text, { type: 'error' }); }
}
