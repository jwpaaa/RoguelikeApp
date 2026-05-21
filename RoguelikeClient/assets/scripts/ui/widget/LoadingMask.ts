/**
 * 全屏 Loading 遮罩（支持嵌套 refCount）
 */

import { UINode } from '../core/UINode';
import { instance as UI } from '../core/UIManager';
import { Palette, FontSize, DesignResolution } from '../core/UIConst';
import { Logger } from '../../utils/Logger';
import type { cc } from '../core/CocosAdapter';

let _node: cc.Node | null = null;
let _refs = 0;
let _label: cc.Label | null = null;
const _tokens = new Set<number>();
let _seq = 1;

export class LoadingMask {
    static show(text?: string): number {
        const token = _seq++;
        _tokens.add(token);
        _refs++;
        if (_refs === 1) {
            const layer = UI.getLayer('loading');
            if (layer) {
                _node = UINode.panel({
                    name: 'LoadingMask',
                    size: { w: DesignResolution.WIDTH, h: DesignResolution.HEIGHT },
                    color: 0x00000066,
                });
                const lbl = UINode.label({
                    text: text || '加载中...',
                    fontSize: FontSize.NORMAL,
                    color: Palette.WHITE,
                });
                _node.addChild(lbl.node);
                _label = lbl.label;
                layer.addChild(_node);
            }
        } else if (_label && text) {
            _label.string = text;
        }
        Logger.debug('Loading', 'show #' + token + ' refs=' + _refs);
        return token;
    }

    static hide(token?: number): void {
        if (token != null) {
            if (!_tokens.has(token)) return;
            _tokens.delete(token);
        } else {
            _tokens.clear();
            _refs = 1;
        }
        _refs = Math.max(0, _refs - 1);
        Logger.debug('Loading', 'hide refs=' + _refs);
        if (_refs === 0 && _node) {
            _node.destroy();
            _node = null;
            _label = null;
        }
    }

    static updateText(text: string): void {
        if (_label) _label.string = text;
    }
}
