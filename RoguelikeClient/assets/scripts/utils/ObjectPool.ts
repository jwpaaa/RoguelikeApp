/**
 * 通用对象池（性能关键路径用，如子弹/特效/伤害飘字）
 * ---------------------------------------------------------------
 * 微信小游戏在高密度战斗场景下若每帧 new/free 大量对象会触发
 * V8 GC 抖动 → 帧时间尖刺。使用对象池可显著降低 GC 压力。
 *
 * @example
 *   const pool = new ObjectPool<Bullet>(
 *     () => new Bullet(),       // 工厂
 *     (b) => b.reset(),         // 回收时重置
 *     128                       // 预热数量
 *   );
 *   const b = pool.acquire();
 *   pool.release(b);
 */

export type Factory<T>  = () => T;
export type ResetFn<T> = (obj: T) => void;

export class ObjectPool<T> {
    private _factory: Factory<T>;
    private _reset: ResetFn<T> | null;
    private _free: T[];
    private _size: number;

    /**
     * @param factory 创建新对象的工厂
     * @param resetFn 释放时调用，重置对象
     * @param warmup  预创建数量
     */
    constructor(factory: Factory<T>, resetFn?: ResetFn<T>, warmup: number = 0) {
        this._factory = factory;
        this._reset = resetFn || null;
        this._free = [];
        this._size = 0;
        for (let i = 0; i < warmup; i++) {
            this._free.push(factory());
            this._size++;
        }
    }

    /** 取对象（无可用则新建） */
    acquire(): T {
        const obj = this._free.pop();
        if (obj !== undefined) return obj;
        this._size++;
        return this._factory();
    }

    /** 归还对象 */
    release(obj: T): void {
        if (this._reset) this._reset(obj);
        this._free.push(obj);
    }

    /** 当前总量（创建过的对象数） */
    get totalSize(): number { return this._size; }

    /** 当前空闲数量 */
    get availableSize(): number { return this._free.length; }

    /** 清空（一般用于场景切换） */
    clear(): void {
        this._free.length = 0;
        this._size = 0;
    }
}
