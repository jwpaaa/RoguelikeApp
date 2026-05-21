/**
 * 随机地图生成（BSP + A* + 可放置区域标记）
 */

import { SeededRandom } from '../utils/SeededRandom';
import { MapConfig, TileType, type TileTypeValue } from '../config/MapConfig';
import { AStarPathfinding, type Pt } from './AStarPathfinding';

interface Rect { x: number; y: number; w: number; h: number; }

export interface GameMap {
    width: number;
    height: number;
    tiles: TileTypeValue[][];
    path: Pt[];
    spawnPoint: Pt;
    crystalPoint: Pt;
    seed: number;
}

export class MapGenerator {
    generate(seed: number, width?: number, height?: number): GameMap {
        const w = width  || MapConfig.WIDTH;
        const h = height || MapConfig.HEIGHT;
        const rng = new SeededRandom(seed);

        const regions = this._bspPartition(w, h, MapConfig.BSP_DEPTH, rng);
        const tiles = this._createGrid(w, h);
        for (const r of regions) this._placeObstacles(tiles, r, rng);

        const spawn: Pt   = { x: 0,     y: Math.floor(h / 2) };
        const crystal: Pt = { x: w - 1, y: Math.floor(h / 2) };
        tiles[spawn.y][spawn.x]     = TileType.EMPTY;
        tiles[crystal.y][crystal.x] = TileType.EMPTY;

        const finder = new AStarPathfinding();
        let path = finder.findPath(tiles, spawn, crystal);
        if (!path) {
            this._clearBlocking(tiles, spawn);
            this._clearBlocking(tiles, crystal);
            path = finder.findPath(tiles, spawn, crystal);
            if (!path) return this._fallback(w, h, seed);
        }
        return this._finalize(tiles, path, spawn, crystal, seed, rng);
    }

    private _bspPartition(w: number, h: number, depth: number, rng: SeededRandom): Rect[] {
        let result: Rect[] = [{ x: 0, y: 0, w, h }];
        for (let d = 0; d < depth; d++) {
            const next: Rect[] = [];
            for (const r of result) {
                if (r.w > 6 || r.h > 5) {
                    const split = this._split(r, rng);
                    next.push(split[0], split[1]);
                } else {
                    next.push(r);
                }
            }
            result = next;
        }
        return result;
    }

    private _split(rect: Rect, rng: SeededRandom): [Rect, Rect] {
        const horizontal = rng.nextBool();
        if (horizontal && rect.h > 4) {
            const splitY = rect.y + rng.nextInt(2, rect.h - 1);
            return [
                { x: rect.x, y: rect.y, w: rect.w, h: splitY - rect.y },
                { x: rect.x, y: splitY, w: rect.w, h: rect.y + rect.h - splitY },
            ];
        }
        if (rect.w > 4) {
            const splitX = rect.x + rng.nextInt(2, rect.w - 1);
            return [
                { x: rect.x, y: rect.y, w: splitX - rect.x, h: rect.h },
                { x: splitX, y: rect.y, w: rect.x + rect.w - splitX, h: rect.h },
            ];
        }
        return [rect, rect];
    }

    private _createGrid(w: number, h: number): TileTypeValue[][] {
        const g: TileTypeValue[][] = new Array(h);
        for (let y = 0; y < h; y++) g[y] = new Array(w).fill(TileType.EMPTY);
        return g;
    }

    private _placeObstacles(tiles: TileTypeValue[][], region: Rect, rng: SeededRandom): void {
        const { OBSTACLE_DENSITY_MIN, OBSTACLE_DENSITY_MAX } = MapConfig;
        const density = OBSTACLE_DENSITY_MIN + rng.next() * (OBSTACLE_DENSITY_MAX - OBSTACLE_DENSITY_MIN);
        for (let y = region.y; y < region.y + region.h; y++) {
            for (let x = region.x; x < region.x + region.w; x++) {
                if (rng.next() < density) tiles[y][x] = TileType.OBSTACLE;
            }
        }
    }

    private _clearBlocking(tiles: TileTypeValue[][], p: Pt): void {
        const h = tiles.length;
        const w = tiles[0].length;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const nx = p.x + dx;
                const ny = p.y + dy;
                if (nx >= 0 && nx < w && ny >= 0 && ny < h) tiles[ny][nx] = TileType.EMPTY;
            }
        }
    }

    private _finalize(tiles: TileTypeValue[][], path: Pt[], spawn: Pt, crystal: Pt, seed: number, rng: SeededRandom): GameMap {
        for (const p of path) tiles[p.y][p.x] = TileType.PATH;

        const placeable = new Set<number>();
        const r = MapConfig.PLACEABLE_BAND_RADIUS;
        const w = tiles[0].length;
        const h = tiles.length;
        for (const p of path) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    const nx = p.x + dx;
                    const ny = p.y + dy;
                    if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                        if (tiles[ny][nx] === TileType.EMPTY) placeable.add(nx * 1000 + ny);
                    }
                }
            }
        }
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (tiles[y][x] === TileType.EMPTY && !placeable.has(x * 1000 + y)) {
                    if (rng.next() < MapConfig.PLACEABLE_EXTRA_RATE) placeable.add(x * 1000 + y);
                }
            }
        }
        for (const k of placeable) {
            const x = Math.floor(k / 1000);
            const y = k % 1000;
            tiles[y][x] = TileType.PLACEABLE;
        }
        tiles[spawn.y][spawn.x]     = TileType.ENTRANCE;
        tiles[crystal.y][crystal.x] = TileType.CRYSTAL;

        return { width: w, height: h, tiles, path, spawnPoint: spawn, crystalPoint: crystal, seed };
    }

    private _fallback(w: number, h: number, seed: number): GameMap {
        const tiles = this._createGrid(w, h);
        const spawn: Pt   = { x: 0,     y: Math.floor(h / 2) };
        const crystal: Pt = { x: w - 1, y: Math.floor(h / 2) };
        const path: Pt[] = [];
        for (let x = 0; x < w; x++) {
            tiles[spawn.y][x] = TileType.PATH;
            path.push({ x, y: spawn.y });
            if (spawn.y - 1 >= 0) tiles[spawn.y - 1][x] = TileType.PLACEABLE;
            if (spawn.y + 1 < h)  tiles[spawn.y + 1][x] = TileType.PLACEABLE;
        }
        tiles[spawn.y][spawn.x]     = TileType.ENTRANCE;
        tiles[crystal.y][crystal.x] = TileType.CRYSTAL;
        return { width: w, height: h, tiles, path, spawnPoint: spawn, crystalPoint: crystal, seed };
    }
}
