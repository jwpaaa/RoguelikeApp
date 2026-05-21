/**
 * 服务端配置加载
 * ---------------------------------------------------------------
 * 从环境变量读取，提供默认值。不强依赖 dotenv，调用方可在启动前
 * 自行设置或通过 `node --env-file=.env src/index.js` 加载。
 */

'use strict';

const env = (key, defVal) => {
    const v = process.env[key];
    return v === undefined || v === '' ? defVal : v;
};

const config = Object.freeze({
    port:           parseInt(env('PORT', '8765'), 10),
    metricsPort:    parseInt(env('METRICS_PORT', '0'), 10),  // 0 = 不启用
    wsImpl:         env('WS_IMPL', 'ws'),
    mongoUrl:       env('MONGO_URL', ''),
    mongoDb:        env('MONGO_DB', 'rtd'),
    redisUrl:       env('REDIS_URL', ''),
    wxAppId:        env('WX_APP_ID', ''),
    wxAppSecret:    env('WX_APP_SECRET', ''),
    logLevel:       env('LOG_LEVEL', 'INFO'),
    jwtSecret:      env('JWT_SECRET', 'dev_secret_change_me'),
    maxRooms:       parseInt(env('MAX_ROOMS', '2000'), 10),
    maxPlayersPerRoom: parseInt(env('MAX_PLAYERS_PER_ROOM', '4'), 10),
    stateHashIntervalWaves: parseInt(env('STATE_HASH_INTERVAL_WAVES', '3'), 10),
});

module.exports = { config };
