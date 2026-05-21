/**
 * 延迟指示器（右上角）
 */

import { UIBase } from '../core/UIBase';
import { UINode } from '../core/UINode';
import { instance as UI } from '../core/UIManager';
import { Palette, FontSize, DesignResolution } from '../core/UIConst';
import { cc } from '../core/CocosAdapter';
import { Toast } from '../widget/Toast';
import type { PingLevel } from '../../network/PingMonitor';

const LEVEL_COLOR: Record<PingLevel, number> = {
    green:  Palette.GREEN,
    yellow: 0xF39C12FF,
    red:    Palette.RED,
};

export class PingIndicator extends UIBase {
    public label: cc.Label | null = null;

    constructor() {
        super({});
        this._build();
        this._bind();
    }

    private _build(): void {
        const layer = UI.getLayer('hud');
        if (!layer) return;
        const { node, label } = UINode.label({
            text: '',
            fontSize: FontSize.SMALL,
            color: Palette.GREEN,
            pos: { x: DesignResolution.WIDTH / 2 - 80, y: DesignResolution.HEIGHT / 2 - 90 },
        });
        layer.addChild(node);
        this.node = node;
        this.label = label;
    }

    private _bind(): void {
        this.listen('ping_update', (payload: any) => this._update(payload.rtt, payload.level));
        this.listen('weak_network', () => Toast.warn('网络较差'));
    }

    private _update(rtt: number, level: PingLevel): void {
        if (!this.label) return;
        this.label.string = '📶 ' + rtt + 'ms';
        this.label.color = cc.Color.fromHEX(LEVEL_COLOR[level] || Palette.GREEN);
    }
}
