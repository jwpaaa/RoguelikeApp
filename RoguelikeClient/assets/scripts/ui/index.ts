/**
 * UI 模块汇总入口
 */

import { instance as UIManager } from './core/UIManager';
import { Toast } from './widget/Toast';
import { Dialog } from './widget/Dialog';
import { LoadingMask } from './widget/LoadingMask';
import { DamagePopupRenderer } from './widget/DamagePopup';
import { TopBar } from './hud/TopBar';
import { BuffBar } from './hud/BuffBar';
import { ItemBar } from './hud/ItemBar';
import { PingIndicator } from './hud/PingIndicator';
import { PauseMenu } from './hud/PauseMenu';
import type { BattleManager } from '../battle/BattleManager';

export interface MountHUDCtx {
    battle: BattleManager;
    playerId: string;
    online?: boolean;
}

export interface MountHUDResult {
    topBar: TopBar;
    buffBar: BuffBar;
    itemBar: ItemBar;
    pauseMenu: PauseMenu;
    pingIndicator: PingIndicator | null;
    damagePopup: DamagePopupRenderer;
    destroy(): void;
}

/** 一次性挂载完整战斗 HUD */
export function mountBattleHUD(ctx: MountHUDCtx): MountHUDResult {
    const topBar      = new TopBar(ctx);
    const buffBar     = new BuffBar(ctx);
    const itemBar     = new ItemBar(ctx);
    const pauseMenu   = new PauseMenu(ctx);
    const damagePopup = new DamagePopupRenderer();
    const pingIndicator = ctx.online ? new PingIndicator() : null;

    return {
        topBar, buffBar, itemBar, pauseMenu, pingIndicator, damagePopup,
        destroy(): void {
            topBar.destroy();
            buffBar.destroy();
            itemBar.destroy();
            pauseMenu.destroy();
            if (pingIndicator) pingIndicator.destroy();
        },
    };
}

export {
    UIManager,
    Toast,
    Dialog,
    LoadingMask,
    DamagePopupRenderer,
    TopBar,
    BuffBar,
    ItemBar,
    PingIndicator,
    PauseMenu,
};
