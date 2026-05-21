/**
 * 地图生成参数（来自需求文档 §F-2.1）
 */

export const MapConfig = Object.freeze({
    WIDTH: 20,
    HEIGHT: 15,
    BSP_DEPTH: 3,
    OBSTACLE_DENSITY_MIN: 0.15,
    OBSTACLE_DENSITY_MAX: 0.30,
    PLACEABLE_BAND_RADIUS: 2,
    PLACEABLE_EXTRA_RATE: 0.075,
    DECORATION_RATE: 0.03,
});

export const TileType = Object.freeze({
    EMPTY:     0,
    PATH:      1,
    OBSTACLE:  2,
    PLACEABLE: 3,
    ENTRANCE:  4,
    CRYSTAL:   5,
});

export type TileTypeValue = typeof TileType[keyof typeof TileType];
