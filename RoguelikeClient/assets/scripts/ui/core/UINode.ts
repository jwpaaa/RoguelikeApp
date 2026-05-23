/**
 * UI 节点工厂（动态生成 UI 节点的便捷方法）
 */

import { cc } from './CocosAdapter';
import { Palette, FontSize } from './UIConst';

export interface PosVec { x: number; y?: number; z?: number; }
export interface SizeVec { w: number; h: number; }
export interface AnchorVec { x: number; y: number; }

export interface BaseOpts {
    name?: string;
    size?: SizeVec;
    pos?:  PosVec;
    anchor?: AnchorVec;
}

export interface PanelOpts extends BaseOpts { color?: string | number; }

export interface LabelOpts extends BaseOpts {
    text?: string;
    fontSize?: number;
    color?: string | number;
}

export interface ButtonOpts {
    text: string;
    size?: SizeVec;
    pos?:  PosVec;
    anchor?: AnchorVec;
    color?: string | number;
    textColor?: string | number;
    fontSize?: number;
    onClick?: (...args: unknown[]) => void;
    disabled?: boolean;
}

export interface ProgressBarOpts {
    name?: string;
    size: SizeVec;
    pos?:  PosVec;
    anchor?: AnchorVec;
    bgColor?: string | number;
    fgColor?: string | number;
    value?: number;
}

export interface RowColOpts {
    name?: string;
    gap?:  number;
    pos?:  PosVec;
    anchor?: AnchorVec;
}

export interface LabelResult { node: cc.Node; label: cc.Label; }
export interface ButtonResult { node: cc.Node; label: cc.Label; button: cc.Button; }
export interface ProgressBarResult {
    node: cc.Node;
    fg: cc.Node;
    setValue(v: number): void;
}
export interface RowColResult { node: cc.Node; layout: cc.Layout; }

export class UINode {
    /** 空节点 + UITransform */
    static empty({ name, size, pos, anchor }: BaseOpts): cc.Node {
        const node = new cc.Node(name || 'Node');
        const tr = node.addComponent(cc.UITransform);
        if (size) tr.setContentSize(size.w, size.h);
        if (anchor) tr.setAnchorPoint(anchor.x, anchor.y);
        if (pos) node.setPosition(pos.x, pos.y || 0, pos.z || 0);
        return node;
    }

    /** 把 "RRGGBBAA" 字符串转成 Color */
    private static _parseColor(hex: string | number): cc.Color {
        if (typeof hex === 'number') hex = hex.toString(16).padStart(8, '0');
        return new cc.Color(
            parseInt(hex.substring(0, 2), 16),
            parseInt(hex.substring(2, 4), 16),
            parseInt(hex.substring(4, 6), 16),
            parseInt(hex.substring(6, 8), 16),
        );
    }

    /** 纯色背景节点 */
    static panel({ name, size, pos, anchor, color }: PanelOpts): cc.Node {
        const node = UINode.empty({ name: name || 'Panel', size, pos, anchor });
        const sp = node.addComponent(cc.Sprite);
        if (color !== undefined) sp.color = UINode._parseColor(color);
        return node;
    }

    /** 文本节点 */
    static label({ name, text, fontSize, color, size, pos, anchor }: LabelOpts): LabelResult {
        const node = UINode.empty({ name: name || 'Label', size, pos, anchor });
        const lbl = node.addComponent(cc.Label);
        lbl.string = text || '';
        lbl.fontSize = fontSize || FontSize.NORMAL;
        if (color !== undefined) lbl.color = UINode._parseColor(color);
        return { node, label: lbl };
    }

    /** 按钮 */
    static button(opts: ButtonOpts): ButtonResult {
        const size = opts.size || { w: 160, h: 50 };
        const node = UINode.panel({
            name: 'Btn_' + (opts.text || ''),
            size, pos: opts.pos, anchor: opts.anchor,
            color: opts.color !== undefined ? opts.color : (opts.disabled ? Palette.BTN_DISABLED : Palette.BTN_NORMAL),
        });
        const btn = node.addComponent(cc.Button);
        btn.transition = 1;
        const { node: lblNode, label } = UINode.label({
            text: opts.text,
            fontSize: opts.fontSize || FontSize.NORMAL,
            color: opts.textColor || Palette.WHITE,
            size, pos: { x: 0, y: 0 },
        });
        node.addChild(lblNode);
        if (opts.onClick) node.on('click', opts.onClick);
        return { node, label, button: btn };
    }

    /** 进度条 */
    static progressBar({ name, size, pos, anchor, bgColor, fgColor, value }: ProgressBarOpts): ProgressBarResult {
        const node = UINode.panel({
            name: name || 'ProgressBar', size, pos, anchor,
            color: bgColor !== undefined ? bgColor : Palette.HP_BAR_BG,
        });
        const fg = UINode.panel({
            name: 'Fg',
            size: { w: size.w * (value == null ? 1 : value), h: size.h },
            pos: { x: -size.w / 2, y: 0 }, anchor: { x: 0, y: 0.5 },
            color: fgColor !== undefined ? fgColor : Palette.HP_BAR_FG,
        });
        node.addChild(fg);
        return {
            node, fg,
            setValue(v: number): void {
                const tr = fg.getComponent(cc.UITransform);
                if (tr) tr.setContentSize(Math.max(0, Math.min(1, v)) * size.w, size.h);
            },
        };
    }

    static row({ name, gap, pos, anchor }: RowColOpts): RowColResult {
        const node = UINode.empty({ name: name || 'Row', pos, anchor });
        const layout = node.addComponent(cc.Layout);
        layout.type = 1; // HORIZONTAL
        layout.spacingX = gap || 8;
        return { node, layout };
    }
    static column({ name, gap, pos, anchor }: RowColOpts): RowColResult {
        const node = UINode.empty({ name: name || 'Col', pos, anchor });
        const layout = node.addComponent(cc.Layout);
        layout.type = 2; // VERTICAL
        layout.spacingY = gap || 8;
        return { node, layout };
    }

    /** 销毁所有子节点 */
    static clearChildren(node: cc.Node): void {
        const children = node.children.slice();
        for (const c of children) c.destroy();
    }
}
