/**
 * 分级日志工具
 * ---------------------------------------------------------------
 * - 战斗模块大量调用，开发期 DEBUG 输出，发布期需关闭。
 * - 微信小游戏控制台对 console 信息有截断/限速，封装统一入口
 *   也便于后期接入埋点上报系统（ANALYSIS）。
 */

export const LEVEL = Object.freeze({
    DEBUG: 0,
    INFO:  1,
    WARN:  2,
    ERROR: 3,
    OFF:   99,
});

export type LogLevel = typeof LEVEL[keyof typeof LEVEL];

let _level: number = LEVEL.INFO;

/** 上报器签名 */
export type LogReporter = (lvl: number, tag: string, args: unknown[]) => void;

let _reporter: LogReporter | null = null;

function setLevel(lvl: number): void { _level = lvl; }
function setReporter(fn: LogReporter | null): void { _reporter = fn; }

function _log(lvl: number, tag: string, args: unknown[]): void {
    if (lvl < _level) return;
    const prefix = `[${tag}]`;
    if (lvl === LEVEL.ERROR)      console.error(prefix, ...args);
    else if (lvl === LEVEL.WARN)  console.warn(prefix, ...args);
    else                          console.log(prefix, ...args);
    if (_reporter) {
        try { _reporter(lvl, tag, args); } catch { /* swallow */ }
    }
}

export const Logger = {
    LEVEL,
    setLevel,
    setReporter,
    debug: (tag: string, ...args: unknown[]): void => _log(LEVEL.DEBUG, tag, args),
    info:  (tag: string, ...args: unknown[]): void => _log(LEVEL.INFO,  tag, args),
    warn:  (tag: string, ...args: unknown[]): void => _log(LEVEL.WARN,  tag, args),
    error: (tag: string, ...args: unknown[]): void => _log(LEVEL.ERROR, tag, args),
};
