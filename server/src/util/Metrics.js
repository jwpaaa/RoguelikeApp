/**
 * Prometheus 指标暴露（来自需求文档 §11 监控告警）
 * ---------------------------------------------------------------
 * 使用最简实现（不引第三方包）：内存维护 counter / gauge，
 * 通过 HTTP /metrics 输出 prometheus 文本格式。
 *
 * 真生产可换 prom-client，本实现已满足基本告警需求。
 */

'use strict';

const http = require('http');
const { Logger } = require('./Logger');

class Metrics {
    constructor() {
        /** @type {Map<string, number>} */
        this.counters = new Map();
        /** @type {Map<string, number>} */
        this.gauges = new Map();
        this._server = null;
    }

    inc(name, delta) {
        this.counters.set(name, (this.counters.get(name) || 0) + (delta || 1));
    }
    set(name, value) { this.gauges.set(name, value); }
    add(name, delta) { this.gauges.set(name, (this.gauges.get(name) || 0) + delta); }

    /** 在指定端口启动 /metrics HTTP 服务 */
    listen(port) {
        if (this._server) return;
        this._server = http.createServer((req, res) => {
            if (req.url !== '/metrics') {
                res.writeHead(404); res.end('not found'); return;
            }
            const lines = [];
            for (const [k, v] of this.counters) {
                lines.push(`# TYPE ${k} counter`);
                lines.push(`${k} ${v}`);
            }
            for (const [k, v] of this.gauges) {
                lines.push(`# TYPE ${k} gauge`);
                lines.push(`${k} ${v}`);
            }
            res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
            res.end(lines.join('\n') + '\n');
        });
        this._server.listen(port, () => Logger.info('Metrics', '/metrics on port', port));
    }

    stop() {
        if (this._server) { this._server.close(); this._server = null; }
    }
}

const instance = new Metrics();
module.exports = { Metrics, instance };
