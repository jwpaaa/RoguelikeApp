/**
 * 服务端日志
 * ---------------------------------------------------------------
 * 与客户端 Logger 接口对齐，方便日后共享代码风格。
 * 输出含时间戳和 PID，便于多实例部署时聚合分析。
 */

'use strict';

const { config } = require('../config');

const LEVEL = Object.freeze({
    DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, OFF: 99,
});

const _lvl = (() => {
    const name = (config.logLevel || 'INFO').toUpperCase();
    return LEVEL[name] !== undefined ? LEVEL[name] : LEVEL.INFO;
})();

function _ts() {
    const d = new Date();
    const pad = (n, l) => String(n).padStart(l || 2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

function _log(lvl, prefix, tag, args) {
    if (lvl < _lvl) return;
    const head = `[${_ts()}][${process.pid}][${prefix}][${tag}]`;
    if (lvl === LEVEL.ERROR)      console.error(head, ...args);
    else if (lvl === LEVEL.WARN)  console.warn(head, ...args);
    else                          console.log(head, ...args);
}

const Logger = {
    LEVEL,
    debug: (tag, ...args) => _log(LEVEL.DEBUG, 'D', tag, args),
    info:  (tag, ...args) => _log(LEVEL.INFO,  'I', tag, args),
    warn:  (tag, ...args) => _log(LEVEL.WARN,  'W', tag, args),
    error: (tag, ...args) => _log(LEVEL.ERROR, 'E', tag, args),
};

module.exports = { Logger };
