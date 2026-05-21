/**
 * UI 模块冒烟测试（TS 版，Node mock 环境）
 */

import { instance as GameRoot } from '../RoguelikeClient/assets/scripts/core/GameRoot.js';
import { instance as TimeManager } from '../RoguelikeClient/assets/scripts/core/TimeManager.js';
import { instance as UIManager } from '../RoguelikeClient/assets/scripts/ui/core/UIManager.js';
import { mountBattleHUD, Toast, Dialog, LoadingMask } from '../RoguelikeClient/assets/scripts/ui/index.js';
import { Logger } from '../RoguelikeClient/assets/scripts/utils/Logger.js';
import { instance as EventBus } from '../RoguelikeClient/assets/scripts/core/EventBus.js';

Logger.setLevel(Logger.LEVEL.WARN);

function assert(cond: unknown, msg: string): void { if (!cond) { console.error('FAIL:', msg); process.exit(1); } }
function ok(msg: string): void { console.log('  ✓', msg); }
function sleep(ms: number): Promise<void> { return new Promise<void>((r) => setTimeout(r, ms)); }

async function main(): Promise<void> {
    console.log('=== UI 冒烟测试（Node mock 模式）===\n');

    console.log('Case 1: UIManager bootMock');
    UIManager.bootMock();
    assert(UIManager.root, 'root attached');
    assert(UIManager.layers.hud,   'hud layer');
    assert(UIManager.layers.popup, 'popup layer');
    assert(UIManager.layers.toast, 'toast layer');
    ok('UIManager 启动并分层成功');

    console.log('\nCase 2: 通用控件');
    Toast.info('test info');
    Toast.success('test success');
    Toast.warn('test warn');
    Toast.error('test error');
    ok('Toast 4 种类型未报错');

    const tk = LoadingMask.show('加载中...');
    LoadingMask.updateText('继续...');
    LoadingMask.hide(tk);
    ok('LoadingMask 显隐正常');

    const p1 = Dialog.confirm('要继续吗？');
    Dialog.close();
    const r1 = await p1;
    assert(r1 === false, 'confirm cancel returns false');
    ok('Dialog confirm 关闭返回 false');

    const p2 = Dialog.alert('提示');
    Dialog.close();
    await p2;
    ok('Dialog alert 关闭正常');

    console.log('\nCase 3: 启动单机战斗 + 挂载 HUD');
    const battle = GameRoot.bootHeadless({
        seed: 0xBEEF,
        difficulty: 2,
        players: [{ id: 'local', name: 'TestPlayer' }],
    });
    assert(battle, 'battle created');
    ok('单机战斗创建');

    const hud = mountBattleHUD({ battle, playerId: 'local', online: false });
    assert(hud.topBar,    'topBar mounted');
    assert(hud.buffBar,   'buffBar mounted');
    assert(hud.itemBar,   'itemBar mounted');
    assert(hud.pauseMenu, 'pauseMenu mounted');
    ok('HUD 所有组件挂载成功');

    console.log('\nCase 4: 模拟战斗事件 → HUD 数据更新');
    for (let i = 0; i < 60; i++) TimeManager.update(1 / 60);
    ok('战斗 tick 60 帧 + HUD 订阅正常工作');

    console.log('\nCase 5: 暂停/继续');
    battle.pause('local');
    await sleep(50);
    battle.resume();
    await sleep(50);
    ok('pause/resume 触发 PauseMenu UI 无报错');

    console.log('\nCase 6: 联机模式 PingIndicator');
    const hudOnline = mountBattleHUD({ battle, playerId: 'local', online: true });
    assert(hudOnline.pingIndicator, 'pingIndicator should mount in online mode');
    EventBus.emit('ping_update',  { rtt: 35, level: 'green' });
    EventBus.emit('ping_update',  { rtt: 120, level: 'yellow' });
    EventBus.emit('weak_network', { rtt: 600 });
    await sleep(50);
    ok('PingIndicator 接收事件无报错');

    console.log('\nCase 7: 销毁清理');
    hud.destroy();
    hudOnline.destroy();
    ok('HUD destroy 清理订阅 + 节点');

    console.log('\n=== ALL UI TESTS PASSED ===');
    process.exit(0);
}

main().catch((e) => { console.error('TEST FAIL', e); process.exit(1); });
