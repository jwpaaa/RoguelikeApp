/**
 * 数学工具集
 * ---------------------------------------------------------------
 * 这里允许使用 Math.*（例如 sqrt/atan2/sin/cos）—— 它们在所有
 * 正常 JS 运行时下结果稳定（IEEE-754 已限定）。但角度/距离比较
 * 时尽量配合 FixedPoint 使用，避免误差累积。
 */

export interface Vec2 { x: number; y: number; }

export const PI = Math.PI;
export const TWO_PI = PI * 2;

/** 距离平方（避免开方） */
export function distSq(ax: number, ay: number, bx: number, by: number): number {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
}

/** 欧式距离 */
export function dist(ax: number, ay: number, bx: number, by: number): number {
    return Math.sqrt(distSq(ax, ay, bx, by));
}

/** 切比雪夫距离（8 方向格距） */
export function chebyshev(ax: number, ay: number, bx: number, by: number): number {
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/** 曼哈顿距离（4 方向格距） */
export function manhattan(ax: number, ay: number, bx: number, by: number): number {
    return Math.abs(ax - bx) + Math.abs(ay - by);
}

/** 限定到区间 [lo, hi] */
export function clamp(v: number, lo: number, hi: number): number {
    return v < lo ? lo : v > hi ? hi : v;
}

/** 线性插值 */
export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/** 角度归一化到 [-PI, PI] */
export function normAngle(a: number): number {
    while (a > PI)  a -= TWO_PI;
    while (a < -PI) a += TWO_PI;
    return a;
}

/** 弧度（atan2 包装） */
export function angleTo(fromX: number, fromY: number, toX: number, toY: number): number {
    return Math.atan2(toY - fromY, toX - fromX);
}

/** 圆形范围检测 */
export function inRange(ax: number, ay: number, bx: number, by: number, range: number): boolean {
    return distSq(ax, ay, bx, by) <= range * range;
}
