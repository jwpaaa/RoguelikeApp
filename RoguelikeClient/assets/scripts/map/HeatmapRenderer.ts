/**
 * 路径热力图（来自需求文档 §F-2.2.2）
 */

import type { Pt } from './AStarPathfinding';
import type { TileTypeValue } from '../config/MapConfig';

export interface MapLike {
    tiles: TileTypeValue[][];
    path: Pt[];
}

export class HeatmapRenderer {
    /** 沿主路径辐射 3 格内累加访问次数 */
    static compute(map: MapLike): number[][] {
        const h = map.tiles.length;
        const w = map.tiles[0].length;
        const heat: number[][] = new Array(h);
        for (let y = 0; y < h; y++) heat[y] = new Array(w).fill(0);
        for (const p of map.path) {
            for (let dy = -3; dy <= 3; dy++) {
                for (let dx = -3; dx <= 3; dx++) {
                    const nx = p.x + dx;
                    const ny = p.y + dy;
                    if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                        const d = Math.abs(dx) + Math.abs(dy);
                        heat[ny][nx] += Math.max(0, 4 - d);
                    }
                }
            }
        }
        return heat;
    }

    /** 把热力值映射为颜色 (0-1)：低=蓝，中=绿，高=红 */
    static colorOf(v: number, maxV: number): [number, number, number] {
        if (maxV <= 0) return [0, 0, 1];
        const t = Math.min(1, v / maxV);
        if (t < 0.5) {
            const r = 0;
            const g = t * 2;
            const b = 1 - t * 2;
            return [r, g, b];
        }
        const r = (t - 0.5) * 2;
        const g = 1 - (t - 0.5) * 2;
        return [r, g, 0];
    }
}
