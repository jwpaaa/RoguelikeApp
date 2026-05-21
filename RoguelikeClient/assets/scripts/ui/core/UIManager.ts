/**
 * UI 管理器（单例）
 */

import { cc } from './CocosAdapter';
import { ZOrder } from './UIConst';
import { UINode } from './UINode';
import { Logger } from '../../utils/Logger';

const LayerNames = ['game', 'hud', 'popup', 'toast', 'loading', 'debug'] as const;
type LayerName = typeof LayerNames[number];

const LayerZ: Record<LayerName, number> = {
    game:    ZOrder.GAME,
    hud:     ZOrder.HUD,
    popup:   ZOrder.POPUP,
    toast:   ZOrder.TOAST,
    loading: ZOrder.LOADING,
    debug:   ZOrder.DEBUG,
};

export class UIManager {
    public root: cc.Node | null = null;
    public layers: Partial<Record<LayerName, cc.Node>> = {};
    public popupStack: cc.Node[] = [];

    /** 在主场景 onLoad 中调用 */
    attachRoot(canvasNode: cc.Node): void {
        this.root = canvasNode;
        for (const name of LayerNames) {
            const node = UINode.empty({ name: 'Layer_' + name });
            node.setPosition(0, 0, LayerZ[name]);
            this.root.addChild(node);
            this.layers[name] = node;
        }
        Logger.info('UI', 'attached, layers=', LayerNames.join(','));
    }

    /** 测试环境：用 mock root 自启动 */
    bootMock(): void {
        const root = new cc.Node('CanvasMock');
        this.attachRoot(root);
    }

    getLayer(name: LayerName): cc.Node {
        if (!this.root) this.bootMock();
        return this.layers[name] || this.layers.hud!;
    }

    pushPopup(node: cc.Node): void {
        this.getLayer('popup').addChild(node);
        this.popupStack.push(node);
    }

    popPopup(): void {
        const node = this.popupStack.pop();
        if (node) node.destroy();
    }

    clearPopups(): void {
        while (this.popupStack.length > 0) this.popPopup();
    }

    hasPopup(): boolean { return this.popupStack.length > 0; }
}

export const instance = new UIManager();
