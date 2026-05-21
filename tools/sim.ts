/**
 * 无头模拟器 / 自检入口（TS 版）
 * ---------------------------------------------------------------
 * 用法：
 *   npm run test:sim  （从 RoguelikeClient 目录）
 *   或 node build-tools/tools/sim.js（先 tsc 编译）
 *
 * 跑通的目标：
 *   - 项目所有模块加载无错
 *   - 地图生成可达（A* 寻路成功）
 *   - 单机一局推进 15+ 波
 *   - 骰子/抽卡/塔成长/伤害结算/经济变更事件正常触发
 */

import { instance as GameRoot } from '../RoguelikeClient/assets/scripts/core/GameRoot.js';
import { instance as TimeManager } from '../RoguelikeClient/assets/scripts/core/TimeManager.js';
import { instance as EventBus } from '../RoguelikeClient/assets/scripts/core/EventBus.js';
import { Logger } from '../RoguelikeClient/assets/scripts/utils/Logger.js';
import { TileType } from '../RoguelikeClient/assets/scripts/config/MapConfig.js';
import { TowerType, type TowerTypeValue } from '@rtd/shared';
import { ItemType } from '../RoguelikeClient/assets/scripts/config/ItemConfig.js';
import type { BattleManager } from '../RoguelikeClient/assets/scripts/battle/BattleManager.js';

Logger.setLevel(Logger.LEVEL.INFO);

// ===== 事件订阅 =====
let waveCount = 0;
let killCount = 0;
let buildCount = 0;
let bulletCount = 0;
let diceLogged = 0;
let gachaLogged = 0;

EventBus.on('battle_start', (b: any) => {
    console.log('========== BATTLE START ==========');
    console.log('seed=' + b.seed, 'difficulty=' + b.difficulty, 'players=' + b.players.length);
    console.log('map: ' + b.map.width + 'x' + b.map.height + ', path nodes=' + b.map.path.length);
});

EventBus.on('wave_start', ({ wave }: { wave: number }) => {
    waveCount = wave;
    console.log('-- wave_start ' + wave);
});
EventBus.on('wave_end', ({ wave, killed, spawned, isBoss }: any) => {
    console.log('-- wave_end   ' + wave + ' killed=' + killed + '/' + spawned + (isBoss ? ' [BOSS]' : ''));
});
EventBus.on('enemy_killed', () => { killCount++; });
EventBus.on('tower_built',  () => { buildCount++; });
EventBus.on('bullet_fired', () => { bulletCount++; });
EventBus.on('dice_rolled', ({ playerId, dice, picks }: any) => {
    if (diceLogged++ < 5) console.log('  🎲 ' + playerId + ' rolled ' + dice + ' picks=[' + picks.map((p: any) => p.id).join(',') + ']');
});
EventBus.on('gacha_drawn', ({ playerId, card, refundedGold }: any) => {
    if (gachaLogged++ < 5) {
        console.log('  🃏 ' + playerId + ' drew ' + (card?.rarity || '?') + ' ' + (card?.name || '?') + (refundedGold ? ' (dup→+' + refundedGold + 'g)' : ''));
    }
});
EventBus.on('battle_end', (r: any) => {
    console.log('========== BATTLE END ==========');
    console.log('win=' + r.win, 'wave=' + r.wave, 'kills=' + r.kills, 'crystalHp=' + r.crystalHp);
    console.log('score=' + r.score.score, 'grade=' + r.score.grade);
    console.log('总计：建造塔=' + buildCount + ', 子弹=' + bulletCount + ', 击杀=' + killCount);
});

// P1 事件
EventBus.on('shop_open', ({ tier, perPlayer }: any) => {
    const goods = perPlayer.p1 ? perPlayer.p1.goods.map((g: any) => g.name + '(' + g.price + 'g)').join(', ') : '';
    console.log('  🏪 shop_open tier=' + tier + ' goods=[' + goods + ']');
});
EventBus.on('shop_bought', ({ playerId, goods, finalPrice }: any) => {
    console.log('  💸 ' + playerId + ' bought ' + goods.name + ' for ' + finalPrice);
});
EventBus.on('item_used', ({ playerId, itemId }: any) => {
    console.log('  📦 ' + playerId + ' used ' + itemId);
});
EventBus.on('random_event', ({ event, wave }: any) => {
    console.log('  🎁 wave=' + wave + ' random event: ' + event.name + ' (' + event.icon + ')');
});
EventBus.on('pause_enter', ({ source, remainMs }: any) => {
    console.log('  ⏸ pause source=' + source + ' remain=' + remainMs);
});

// AI：自动关闭商店
EventBus.on('shop_open', () => {
    const st = battle.shopCtl.perPlayerState.get('p1');
    if (st) {
        for (let i = 0; i < st.goods.length; i++) {
            const r = battle.shopBuy('p1', i);
            if (r.ok) break;
        }
    }
    battle.shopClose('p1');
});

// ===== 启动 =====
const battle: BattleManager = GameRoot.bootHeadless({
    seed: 0xC0FFEE,
    difficulty: 2,
    players: [{ id: 'p1', name: '测试玩家' }],
});

// AI：自动建塔
function autoBuildOneTower(): void {
    const map = battle.map;
    const towersOnMap = new Set<string>();
    for (const t of battle.em.towers.values()) towersOnMap.add(t.x + ',' + t.y);

    const candidates: Array<{ x: number; y: number; d: number }> = [];
    for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
            if (map.tiles[y][x] !== TileType.PLACEABLE) continue;
            if (towersOnMap.has(x + ',' + y)) continue;
            let minD = Infinity;
            for (const p of map.path) {
                const dx = p.x - x;
                const dy = p.y - y;
                const d = dx * dx + dy * dy;
                if (d < minD) minD = d;
            }
            candidates.push({ x, y, d: minD });
        }
    }
    candidates.sort((a, b) => a.d - b.d);

    const types: TowerTypeValue[] = [TowerType.ARROW, TowerType.CANNON, TowerType.ICE];
    for (const c of candidates) {
        for (const t of types) {
            const r = battle.build('p1', t, c.x, c.y);
            if (r.ok) return;
        }
    }
}

const MAX_TICKS = 60 * 60 * 15;
const RENDER_DT = 1 / 60;
let buildAttemptInterval = 0;
let itemUseInterval = 0;
let lastReport = 0;
for (let i = 0; i < MAX_TICKS; i++) {
    TimeManager.update(RENDER_DT);

    buildAttemptInterval++;
    if (buildAttemptInterval >= 60) {
        buildAttemptInterval = 0;
        autoBuildOneTower();
    }

    itemUseInterval++;
    if (itemUseInterval >= 60 * 30) {
        itemUseInterval = 0;
        if (battle.em.enemies.size >= 5) battle.useItem('p1', ItemType.FREEZE_BOMB);
    }

    if (i - lastReport >= 60 * 5) {
        lastReport = i;
        const e0It = battle.em.enemies.values().next();
        const e0: any = e0It.value;
        const epos = e0 ? `e0=(${e0.x.toFixed(2)},${e0.y.toFixed(2)}) hp=${e0.hp}/${e0.maxHp} pi=${e0.pathIndex} sp=${e0.getSpeed().toFixed(3)} frozen=${e0.frozenMs}` : 'no enemies';
        console.log(`  [t=${(i/60).toFixed(0)}s] wave=${waveCount} towers=${battle.em.towers.size} enemies=${battle.em.enemies.size} crystalHp=${battle.crystal.hp} kills=${killCount} ${epos}`);
    }

    if (battle.state === 'FINISHED') break;
}

console.log('\n=== sim done. final state=' + battle.state + ' wave=' + waveCount + ' ===');
process.exit(0);
