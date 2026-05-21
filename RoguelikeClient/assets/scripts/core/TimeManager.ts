/**
 * 时间管理：固定步长逻辑帧 + 渲染插值
 * ---------------------------------------------------------------
 * 帧同步要求逻辑层使用固定步长（默认 15Hz），渲染层 60Hz 通过
 * 累加插值平滑过渡，避免逻辑帧抖动直接体现在画面上。
 *
 * 用法：
 *   TimeManager.bind(battleLogic);   // battleLogic.tick(dtMs) 在 logicFps 触发
 *   TimeManager.update(deltaMs);     // 每个渲染帧调用（Cocos 的 onUpdate）
 */

export const LOGIC_FPS = 15;
export const LOGIC_DT_MS = Math.floor(1000 / LOGIC_FPS); // 66
const MAX_FRAMES_PER_UPDATE = 5;

export interface ITickable {
    tick(dtMs: number): void;
}

export type TickFn = (dtMs: number) => void;

export class TimeManager {
    private _accumulator: number;
    private _logicFrame: number;
    private _tickFn: TickFn | null;
    private _paused: boolean;
    private _scale: number;

    constructor() {
        this._accumulator = 0;
        this._logicFrame = 0;
        this._tickFn = null;
        this._paused = false;
        this._scale = 1;
    }

    /** 绑定一个 tick 目标对象 */
    bind(target: ITickable): void { this._tickFn = (dt) => target.tick(dt); }

    /** 直接绑定一个函数 */
    bindFn(fn: TickFn): void { this._tickFn = fn; }

    pause():    void { this._paused = true; }
    resume():   void { this._paused = false; }
    isPaused(): boolean { return this._paused; }

    /** 时间倍率，开发/快速演示用 */
    setScale(s: number): void { this._scale = s; }

    reset(): void {
        this._accumulator = 0;
        this._logicFrame = 0;
        this._paused = false;
    }

    get logicFrame(): number { return this._logicFrame; }
    get logicFps():   number { return LOGIC_FPS; }
    get logicDtMs():  number { return LOGIC_DT_MS; }

    /**
     * 渲染帧驱动（Cocos onUpdate 调用，传入秒）
     */
    update(deltaSec: number): void {
        if (this._paused || !this._tickFn) return;
        this._accumulator += deltaSec * 1000 * this._scale;
        let frames = 0;
        while (this._accumulator >= LOGIC_DT_MS && frames < MAX_FRAMES_PER_UPDATE) {
            this._tickFn(LOGIC_DT_MS);
            this._logicFrame++;
            this._accumulator -= LOGIC_DT_MS;
            frames++;
        }
        // 累积过多说明卡顿，丢弃多余时间避免追帧雪崩
        if (this._accumulator > LOGIC_DT_MS * MAX_FRAMES_PER_UPDATE) {
            this._accumulator = 0;
        }
    }

    /** 渲染插值因子 [0,1)，渲染层用其在两逻辑帧间平滑 */
    getRenderAlpha(): number { return this._accumulator / LOGIC_DT_MS; }
}

export const instance = new TimeManager();
