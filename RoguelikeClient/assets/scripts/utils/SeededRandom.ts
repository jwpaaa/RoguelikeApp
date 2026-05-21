/**
 * 确定性随机数（Mulberry32）
 * ---------------------------------------------------------------
 * 在帧同步中，所有客户端必须基于相同种子产生相同的随机序列。
 * Math.random() 不可控且跨平台不一致，因此战斗/地图/抽卡等
 * 涉及随机性的逻辑均必须使用本类。
 */

export class SeededRandom {
    /** 32 位整数种子（内部状态） */
    public seed: number;

    constructor(seed: number) {
        this.seed = seed | 0;
    }

    /**
     * 返回 [0, 1) 浮点数（Mulberry32：质量好、确定、跨平台一致）
     */
    next(): number {
        this.seed = (this.seed + 0x6D2B79F5) | 0;
        let t = this.seed;
        t = Math.imul(t ^ (t >>> 15), 1 | t);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    /** [min, max) 随机整数 */
    nextInt(min: number, max: number): number {
        if (max <= min) return min;
        return Math.floor(this.next() * (max - min)) + min;
    }

    /** [min, max] 随机整数 */
    nextIntInclusive(min: number, max: number): number {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }

    /** 50/50 布尔 */
    nextBool(): boolean { return this.next() < 0.5; }

    /** 命中概率 [0,1] */
    chance(probability: number): boolean { return this.next() < probability; }

    /** 从数组随机抽 1 个 */
    pickOne<T>(arr: T[] | readonly T[]): T | undefined {
        if (!arr || arr.length === 0) return undefined;
        return arr[this.nextInt(0, arr.length)];
    }

    /** 从数组随机抽 n 个不重复（Fisher-Yates 部分洗牌） */
    pickN<T>(arr: T[] | readonly T[], n: number): T[] {
        const result: T[] = [];
        if (!arr || arr.length === 0 || n <= 0) return result;
        const pool: T[] = arr.slice();
        const count = Math.min(n, pool.length);
        for (let i = 0; i < count; i++) {
            const idx = this.nextInt(0, pool.length);
            result.push(pool[idx]);
            pool.splice(idx, 1);
        }
        return result;
    }

    /** 加权随机：weights[i] 越大被抽中概率越高 */
    pickWeighted<T>(items: T[] | readonly T[], weights: number[] | readonly number[]): T {
        let total = 0;
        for (let i = 0; i < weights.length; i++) total += weights[i];
        let r = this.next() * total;
        for (let i = 0; i < items.length; i++) {
            r -= weights[i];
            if (r < 0) return items[i];
        }
        return items[items.length - 1];
    }

    /** 派生子种子（不破坏当前序列） */
    derive(label: string | number): SeededRandom {
        let h = this.seed;
        const s = String(label);
        for (let i = 0; i < s.length; i++) {
            h = ((h << 5) - h + s.charCodeAt(i)) | 0;
        }
        return new SeededRandom(h);
    }

    /** FNV-1a 简易字符串散列（32 位） */
    static hash(str: string): number {
        let h = 2166136261;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h | 0;
    }
}
