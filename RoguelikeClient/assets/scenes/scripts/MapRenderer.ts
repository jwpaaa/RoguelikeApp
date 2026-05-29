import { _decorator, Component, Graphics, Color, Node } from 'cc';
import { instance as EventBus } from '../../scripts/core/EventBus';
import type { GameMap } from '../../scripts/map/MapGenerator';
import type { Tower } from '../../scripts/entity/Tower';
import type { Enemy } from '../../scripts/entity/Enemy';
import { TileType } from '../../scripts/config/MapConfig';

const { ccclass } = _decorator;

const MAP_W = 20;
const MAP_H = 15;
const CELL_W = 50;
const CELL_H = 33;
const OFF_X = -(MAP_W * CELL_W) / 2;
const OFF_Y = -(MAP_H * CELL_H) / 2;

const TOWER_COLORS: Record<string, { r: number; g: number; b: number }> = {
    ARROW:    { r: 255, g: 200, b: 50  },
    CANNON:   { r: 255, g: 80,  b: 80  },
    ICE:      { r: 80,  g: 200, b: 255 },
    MAGIC:    { r: 155, g: 89,  b: 182 },
    ELECTRIC: { r: 255, g: 255, b: 0   },
    POISON:   { r: 80,  g: 220, b: 80  },
    SUMMONER: { r: 255, g: 165, b: 0   },
    TOTEM:    { r: 100, g: 255, b: 200 },
};

@ccclass('MapRenderer')
export class MapRenderer extends Component {

    private _gfx: Graphics | null = null;
    private _map: GameMap | null = null;
    private _towers: Map<string, Tower> = new Map();
    private _enemies: Map<string, Enemy> = new Map();
    private _frameCount = 0;

    start(): void {
        this._gfx = this.node.addComponent(Graphics);

        EventBus.on('tower_add', (t: Tower) => { this._towers.set(t.id, t); this._addTowerHitbox(t); });
        EventBus.on('tower_remove', (t: Tower) => { this._towers.delete(t.id); });
        EventBus.on('enemy_add', (e: Enemy) => { this._enemies.set(e.id, e); });
        EventBus.on('enemy_remove', (e: Enemy) => { this._enemies.delete(e.id); });
    }

    private _addTowerHitbox(tower: Tower): void {
        const hb = new Node('Hitbox_' + tower.id);
        hb.addComponent('cc.UITransform' as any)?.setContentSize(50, 33);
        hb.setPosition(
            OFF_X + tower.x * CELL_W + CELL_W / 2,
            OFF_Y + tower.y * CELL_H + CELL_H / 2,
            0
        );
        hb.on(Node.EventType.TOUCH_END, () => {
            EventBus.emit('tower_clicked', { tower });
        });
        this.node.addChild(hb);
    }

    draw(map: GameMap): void {
        this._map = map;
    }

    update(_dt: number): void {
        if (!this._gfx) return;
        const g = this._gfx;
        g.clear();
        this._frameCount++;

        if (this._frameCount % 15 === 1) {
        }

        // 画地图
        if (this._map) {
            this._drawMap(g);
        }

        // 画塔
        for (const tower of this._towers.values()) {
            if (tower.dead) continue;
            const px = OFF_X + tower.x * CELL_W + CELL_W / 2;
            const py = OFF_Y + tower.y * CELL_H + CELL_H / 2;
            const c = TOWER_COLORS[tower.type] || { r: 200, g: 200, b: 200 };
            g.fillColor = new Color(c.r, c.g, c.b, 255);
            g.rect(px - 10, py - 10, 20, 20);
            g.fill();
            if (tower.level >= 2) {
                g.fillColor = new Color(255, 255, 255, 255);
                g.circle(px + 8, py + 8, 3);
                g.fill();
            }
            if (tower.level >= 3) {
                g.circle(px - 8, py + 8, 3);
                g.fill();
            }
        }

        // 画怪物
        for (const enemy of this._enemies.values()) {
            if (enemy.dead || enemy.reachedEnd) continue;
            // 使用插值后的连续坐标（enemy.x / enemy.y 由 EnemyController 每帧更新）
            const px = OFF_X + enemy.x * CELL_W + CELL_W / 2;
            const py = OFF_Y + enemy.y * CELL_H + CELL_H / 2;
            const hpPct = enemy.hp / enemy.maxHp;

            let cr = 255, cg = 100, cb = 100;
            if (enemy.isBoss) { cr = 255; cg = 50; cb = 50; }
            else if (enemy.flying) { cr = 150; cg = 200; cb = 255; }
            else if (enemy.stealth) { cr = 180; cg = 180; cb = 200; }

            g.fillColor = enemy.stealth ? new Color(cr, cg, cb, 100) : new Color(cr, cg, cb, 255);
            const size = enemy.isBoss ? 16 : 10;
            g.circle(px, py, size);
            g.fill();

            // 血条
            const barW = 20;
            const barH = 4;
            const barY = py - size - 6;
            g.fillColor = new Color(60, 60, 60, 200);
            g.rect(px - barW / 2, barY, barW, barH);
            g.fill();
            g.fillColor = hpPct > 0.5 ? new Color(46, 204, 113, 255)
                : hpPct > 0.25 ? new Color(241, 196, 15, 255)
                : new Color(231, 76, 60, 255);
            g.rect(px - barW / 2, barY, barW * hpPct, barH);
            g.fill();
        }
    }

    private _drawMap(g: Graphics): void {
        const map = this._map!;
        for (let row = 0; row < map.height; row++) {
            for (let col = 0; col < map.width; col++) {
                const tile = map.tiles[row][col];
                const x = OFF_X + col * CELL_W;
                const y = OFF_Y + row * CELL_H;
                switch (tile) {
                    case TileType.PATH:
                        g.fillColor = new Color(139, 90, 43, 180);
                        break;
                    case TileType.BUILDABLE:
                        g.fillColor = new Color(60, 60, 60, 150);
                        break;
                    case TileType.OBSTACLE:
                        g.fillColor = new Color(30, 30, 30, 200);
                        break;
                    default:
                        g.fillColor = new Color(50, 50, 50, 100);
                }
                g.rect(x, y, CELL_W - 1, CELL_H - 1);
                g.fill();
            }
        }

        if (map.path && map.path.length > 1) {
            g.strokeColor = new Color(255, 215, 0, 200);
            g.lineWidth = 3;
            g.moveTo(OFF_X + map.path[0].x * CELL_W + CELL_W / 2, OFF_Y + map.path[0].y * CELL_H + CELL_H / 2);
            for (let i = 1; i < map.path.length; i++) {
                g.lineTo(OFF_X + map.path[i].x * CELL_W + CELL_W / 2, OFF_Y + map.path[i].y * CELL_H + CELL_H / 2);
            }
            g.stroke();
        }

        if (map.crystalPoint) {
            g.fillColor = new Color(231, 76, 60, 255);
            g.circle(OFF_X + map.crystalPoint.x * CELL_W + CELL_W / 2, OFF_Y + map.crystalPoint.y * CELL_H + CELL_H / 2, CELL_W / 3);
            g.fill();
        }
        if (map.spawnPoint) {
            g.fillColor = new Color(46, 204, 113, 255);
            g.circle(OFF_X + map.spawnPoint.x * CELL_W + CELL_W / 2, OFF_Y + map.spawnPoint.y * CELL_H + CELL_H / 2, CELL_W / 3);
            g.fill();
        }
    }

    onDestroy(): void {
        EventBus.clear();
    }
}
