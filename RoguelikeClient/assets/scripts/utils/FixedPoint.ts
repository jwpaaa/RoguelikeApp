/**
 * 定点数（精度 0.001）
 * ---------------------------------------------------------------
 * 帧同步要求所有客户端在同一帧输入下产生完全一致的状态。
 * JS Number 在不同平台 V8 版本下的浮点运算可能出现 ULP 差异，
 * 因此战斗逻辑必须使用定点数完成所有数值运算。
 *
 * 内部以 32 位安全的整数（精度 0.001）存储；提供加减乘除及比较。
 *
 * @example
 *   FixedPoint.fromFloat(3.14)  // value = 3140
 *   FixedPoint.fromInt(5)       // value = 5000
 *   a.multiply(b).toFloat()
 */

export const SCALE = 1000;

export class FixedPoint {
    /** 内部整数（已乘以 SCALE） */
    public value: number;

    constructor(value: number) {
        this.value = value | 0; // 强制 32 位整数，避免浮点尾数
    }

    static fromFloat(f: number): FixedPoint {
        return new FixedPoint(Math.round(f * SCALE));
    }

    static fromInt(n: number): FixedPoint {
        return new FixedPoint(n * SCALE);
    }

    static zero(): FixedPoint { return new FixedPoint(0); }
    static one():  FixedPoint { return new FixedPoint(SCALE); }

    add(o: FixedPoint):      FixedPoint { return new FixedPoint(this.value + o.value); }
    subtract(o: FixedPoint): FixedPoint { return new FixedPoint(this.value - o.value); }

    /** 定点数乘法：(a * b) / SCALE，四舍五入 */
    multiply(o: FixedPoint): FixedPoint {
        return new FixedPoint(Math.round((this.value * o.value) / SCALE));
    }

    /** 定点数除法：(a * SCALE) / b */
    divide(o: FixedPoint): FixedPoint {
        if (o.value === 0) return FixedPoint.zero();
        return new FixedPoint(Math.round((this.value * SCALE) / o.value));
    }

    multiplyInt(n: number): FixedPoint { return new FixedPoint(Math.round(this.value * n)); }
    divideInt(n: number):   FixedPoint { return new FixedPoint(Math.round(this.value / n)); }

    greaterThan(o: FixedPoint):    boolean { return this.value > o.value; }
    greaterOrEqual(o: FixedPoint): boolean { return this.value >= o.value; }
    lessThan(o: FixedPoint):       boolean { return this.value < o.value; }
    lessOrEqual(o: FixedPoint):    boolean { return this.value <= o.value; }
    equals(o: FixedPoint):         boolean { return this.value === o.value; }

    toFloat(): number     { return this.value / SCALE; }
    toInt():   number     { return Math.trunc(this.value / SCALE); }
    clone():   FixedPoint { return new FixedPoint(this.value); }

    abs():    FixedPoint { return new FixedPoint(Math.abs(this.value)); }
    negate(): FixedPoint { return new FixedPoint(-this.value); }

    static min(a: FixedPoint, b: FixedPoint): FixedPoint { return a.value <= b.value ? a : b; }
    static max(a: FixedPoint, b: FixedPoint): FixedPoint { return a.value >= b.value ? a : b; }
    static clamp(v: FixedPoint, lo: FixedPoint, hi: FixedPoint): FixedPoint {
        return FixedPoint.min(FixedPoint.max(v, lo), hi);
    }
}
