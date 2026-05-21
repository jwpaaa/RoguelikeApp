/**
 * A* 寻路（4 方向）
 * ---------------------------------------------------------------
 * 用于：地图生成期校验路径、怪物运行时（地图变更后重路径）。
 * 启发式：曼哈顿距离。
 */

import { TileType, type TileTypeValue } from '../config/MapConfig';

export interface Pt { x: number; y: number; }

export class AStarPathfinding {
    /** 4 方向 A* 寻路 */
    findPath(tiles: TileTypeValue[][], start: Pt, end: Pt, walkableSet?: Set<TileTypeValue>): Pt[] | null {
        const walkable = walkableSet || new Set<TileTypeValue>([
            TileType.EMPTY, TileType.PATH, TileType.PLACEABLE,
            TileType.ENTRANCE, TileType.CRYSTAL,
        ]);
        const h = tiles.length;
        const w = tiles[0].length;
        const inBounds = (x: number, y: number) => x >= 0 && x < w && y >= 0 && y < h;
        const passable = (x: number, y: number) => inBounds(x, y) && walkable.has(tiles[y][x]);

        if (!passable(start.x, start.y) || !passable(end.x, end.y)) return null;

        const startKey = key(start.x, start.y);
        const open = new Map<number, number>();
        const closed = new Set<number>();
        const gScore = new Map<number, number>();
        const came = new Map<number, number>();

        gScore.set(startKey, 0);
        open.set(startKey, manhattan(start, end));

        while (open.size > 0) {
            // 找 f 最小的节点
            let curKey: number | null = null;
            let curF = Infinity;
            for (const [k, f] of open) {
                if (f < curF) { curF = f; curKey = k; }
            }
            if (curKey === null) break;
            const [cx, cy] = parseKey(curKey);
            if (cx === end.x && cy === end.y) {
                return reconstruct(came, curKey);
            }
            open.delete(curKey);
            closed.add(curKey);

            const neighbours: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            const curG = gScore.get(curKey)!;
            for (const [dx, dy] of neighbours) {
                const nx = cx + dx;
                const ny = cy + dy;
                if (!passable(nx, ny)) continue;
                const nk = key(nx, ny);
                if (closed.has(nk)) continue;
                const tg = curG + 1;
                if (tg < (gScore.has(nk) ? gScore.get(nk)! : Infinity)) {
                    came.set(nk, curKey);
                    gScore.set(nk, tg);
                    open.set(nk, tg + manhattan({ x: nx, y: ny }, end));
                }
            }
        }
        return null;
    }
}

function manhattan(a: Pt, b: Pt): number { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
function key(x: number, y: number): number { return x * 1000 + y; }
function parseKey(k: number): [number, number] { return [Math.floor(k / 1000), k % 1000]; }

function reconstruct(came: Map<number, number>, end: number): Pt[] {
    const path: Pt[] = [];
    let cur: number | undefined = end;
    while (cur !== undefined) {
        const [x, y] = parseKey(cur);
        path.push({ x, y });
        cur = came.get(cur);
    }
    return path.reverse();
}
