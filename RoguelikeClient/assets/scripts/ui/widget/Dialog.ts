/**
 * 通用对话框
 */

import { UINode } from '../core/UINode';
import { instance as UI } from '../core/UIManager';
import { UIBase } from '../core/UIBase';
import { Palette, FontSize, DesignResolution } from '../core/UIConst';
import { Logger } from '../../utils/Logger';

export interface DialogOpts {
    title?: string;
    content: string;
    yes?: string;
    no?: string | null;
    type?: 'confirm' | 'alert';
}

let _current: Dialog | null = null;

export class Dialog extends UIBase {
    public opts: Required<Pick<DialogOpts, 'yes' | 'type'>> & Omit<DialogOpts, 'yes' | 'type'>;
    public resolve: ((v: boolean) => void) | null = null;

    constructor(opts: DialogOpts) {
        super({});
        this.opts = { yes: '确定', no: '取消', type: 'confirm', ...opts };
        this._build();
    }

    private _build(): void {
        const layer = UI.getLayer('popup');
        if (!layer) return;

        const mask = UINode.panel({
            name: 'DialogMask',
            size: { w: DesignResolution.WIDTH, h: DesignResolution.HEIGHT },
            color: 0x00000099,
        });
        layer.addChild(mask);

        const panel = UINode.panel({
            name: 'Dialog',
            size: { w: 520, h: 280 },
            color: Palette.PANEL_BG,
        });
        mask.addChild(panel);

        if (this.opts.title) {
            const { node: t } = UINode.label({
                text: this.opts.title,
                fontSize: FontSize.LARGE,
                color: Palette.WHITE,
                pos: { x: 0, y: 100 },
            });
            panel.addChild(t);
        }

        const { node: c } = UINode.label({
            text: this.opts.content,
            fontSize: FontSize.NORMAL,
            color: Palette.WHITE,
            pos: { x: 0, y: 20 },
            size: { w: 480, h: 80 },
        });
        panel.addChild(c);

        const yesBtn = UINode.button({
            text: this.opts.yes,
            size: { w: 160, h: 60 },
            pos: { x: this.opts.no ? 100 : 0, y: -80 },
            onClick: () => this._resolve(true),
        });
        panel.addChild(yesBtn.node);
        if (this.opts.no) {
            const noBtn = UINode.button({
                text: this.opts.no,
                size: { w: 160, h: 60 },
                pos: { x: -100, y: -80 },
                color: Palette.BTN_DISABLED,
                onClick: () => this._resolve(false),
            });
            panel.addChild(noBtn.node);
        }

        this.node = mask;
        Logger.debug('Dialog', this.opts.title || this.opts.content);
    }

    private _resolve(value: boolean): void {
        if (this.resolve) {
            const r = this.resolve;
            this.resolve = null;
            r(value);
        }
        this.destroy();
        _current = null;
    }

    async wait(): Promise<boolean> {
        return new Promise<boolean>((resolve) => { this.resolve = resolve; });
    }

    // ---------- 静态 API ----------

    static confirm(content: string, opts?: Partial<DialogOpts>): Promise<boolean> {
        if (_current) _current._resolve(false);
        _current = new Dialog({ content, type: 'confirm', ...opts });
        _current.show();
        return _current.wait();
    }

    static alert(content: string, opts?: Partial<DialogOpts>): Promise<boolean> {
        if (_current) _current._resolve(false);
        _current = new Dialog({ content, type: 'alert', no: null, ...opts });
        _current.show();
        return _current.wait();
    }

    static close(): void {
        if (_current) _current._resolve(false);
    }
}
