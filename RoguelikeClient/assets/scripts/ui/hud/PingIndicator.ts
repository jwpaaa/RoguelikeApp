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

const LEVEL_COLOR: Record<PingLevel, string> = {
    green:  Palette.GREEN,
    yellow: 'F39C12FF',
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
        const hexStr = LEVEL_COLOR[level] || Palette.GREEN;
        this.label.color = new cc.Color(
            parseInt(hexStr.substring(0, 2), 16),
            parseInt(hexStr.substring(2, 4), 16),
            parseInt(hexStr.substring(4, 6), 16),
            parseInt(hexStr.substring(6, 8), 16),
        );
    }
}
