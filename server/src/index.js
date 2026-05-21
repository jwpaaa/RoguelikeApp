/**
 * 服务端启动入口
 * ---------------------------------------------------------------
 * 装配顺序：
 *   1) 配置 + 日志
 *   2) 数据访问层（store/cache）
 *   3) 业务服务（auth/room/match/battle/chat/leaderboard/analytics）
 *   4) WebSocket 接入 + Router 注册全部消息处理器
 *   5) 优雅停机：捕获 SIGINT / SIGTERM
 *
 * 启动：
 *   PORT=8765 node src/index.js
 *   或：node --env-file=.env src/index.js
 */

'use strict';

const { config } = require('./config');
const { Logger } = require('./util/Logger');
const { createRepos } = require('./store');
const { createCache } = require('./cache');
const { WsServer } = require('./ws/Server');
const { Router } = require('./ws/Router');
const { AuthService } = require('./auth/AuthService');
const { RoomManager } = require('./room/RoomManager');
const { MatchService } = require('./match/MatchService');
const { ChatService } = require('./chat/ChatService');
const { GachaServer, MemoryPityStore } = require('./battle/GachaServer');
const { BattleSession } = require('./battle/BattleSession');
const { LeaderboardService } = require('./leaderboard/LeaderboardService');
const { AnalyticsService } = require('./analytics/AnalyticsService');
const { MessageType, ErrorCode } = require('./shared/MessageTypes');
const { verifyToken } = require('./util/Helpers');

async function main() {
    Logger.info('Boot', 'starting server, port=', config.port);

    // 1) 持久化
    const { users, close: closeRepos } = await createRepos();
    const { cache } = await createCache();

    // 2) 业务服务
    const wsServer = new WsServer();
    const auth = new AuthService(users);
    const roomManager = new RoomManager({ wsServer });
    const matchService = new MatchService({ roomManager });
    const chatService = new ChatService({ roomManager });
    const gachaServer = new GachaServer(new MemoryPityStore());
    const leaderboard = new LeaderboardService({ users, cache });
    const analytics = new AnalyticsService({});
    leaderboard.start();

    // 2.5) Prometheus 指标
    const { instance: Metrics } = require('./util/Metrics');
    if (config.metricsPort > 0) Metrics.listen(config.metricsPort);

    // 3) 路由
    const router = new Router();
    registerHandlers({ router, auth, roomManager, matchService, chatService, gachaServer, users, leaderboard, analytics });

    // 4) WebSocket
    wsServer.onConnect((conn) => {
        Metrics.inc('rtd_connections_total');
        Metrics.add('rtd_connections_active', 1);
        Logger.debug('WS', 'connected', conn.id);
    });
    wsServer.onMessage((conn, msg) => {
        Metrics.inc('rtd_messages_total');
        router.dispatch(conn, msg);
    });
    wsServer.onClose((conn) => {
        Metrics.add('rtd_connections_active', -1);
        if (conn.openid) {
            roomManager.markOffline(conn.openid);
            matchService.cancel(conn.openid);
        }
    });
    await wsServer.start();

    // 5) 优雅停机
    let shuttingDown = false;
    const shutdown = async (sig) => {
        if (shuttingDown) return;
        shuttingDown = true;
        Logger.info('Boot', 'shutdown signal:', sig);
        try {
            leaderboard.stop();
            matchService.stop();
            roomManager.specQueue && roomManager.specQueue.stop();
            Metrics.stop && Metrics.stop();
            await wsServer.stop();
            await closeRepos();
            if (cache.close) await cache.close();
        } catch (e) { Logger.error('Boot', 'shutdown err', e.message); }
        finally { process.exit(0); }
    };
    process.on('SIGINT',  () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('uncaughtException', (e) => Logger.error('Boot', 'uncaught', e.stack));
    process.on('unhandledRejection', (e) => Logger.error('Boot', 'unhandled', e));

    Logger.info('Boot', 'ready');
}

// ===================== Handlers =====================
function registerHandlers(ctx) {
    const { router, auth, roomManager, matchService, chatService, gachaServer, users, leaderboard, analytics } = ctx;

    // ---- 登录 ----
    router.register(MessageType.AUTH_LOGIN, async ({ conn, data }) => {
        const result = await auth.login(data);
        conn.openid = result.openid;
        conn.token  = result.token;
        // 自动加入"全局心跳"
        return { type: MessageType.AUTH_RSP, data: result };
    });

    // ---- 房间 ----
    router.register(MessageType.CREATE_ROOM, ({ conn, data }) => {
        if (!conn.openid) return _err(ErrorCode.UNAUTHORIZED);
        const r = roomManager.createRoom({
            openid: conn.openid, name: data.name || 'P', difficulty: data.difficulty, maxPlayers: data.maxPlayers, connId: conn.id,
        });
        if (r.error) return _err(r.error, r.message);
        conn.roomId = r.room.roomId;
        return { data: { success: true, room: r.room.toJSON() } };
    }, { requireAuth: true });

    router.register(MessageType.JOIN_ROOM, ({ conn, data }) => {
        const r = roomManager.joinRoom({
            openid: conn.openid, name: data.name || 'P', roomId: data.roomId, connId: conn.id,
        });
        if (r.error) return _err(r.error, r.message);
        conn.roomId = data.roomId;
        return { data: { success: true, room: r.room.toJSON() } };
    }, { requireAuth: true });

    router.register(MessageType.LEAVE_ROOM, ({ conn }) => {
        roomManager.leaveRoom(conn.openid);
        conn.roomId = null;
        return { data: { success: true } };
    }, { requireAuth: true });

    router.register(MessageType.KICK_PLAYER, ({ conn, data }) => {
        const r = roomManager.kick(conn.openid, data.targetId);
        if (r.error) return _err(r.error);
        return { data: { success: true } };
    }, { requireAuth: true });

    router.register(MessageType.PLAYER_READY, ({ conn, data }) => {
        const r = roomManager.setReady(conn.openid, !!data.ready);
        if (r.error) return _err(r.error);
        return { data: { success: true } };
    }, { requireAuth: true });

    // ---- 匹配 ----
    router.register(MessageType.START_MATCH, ({ conn, data }) => {
        const r = matchService.enqueue({
            openid: conn.openid, name: data.name || 'P', connId: conn.id,
            difficulty: data.difficulty, allowAi: !!data.allowAi, forceAi: !!data.forceAi,
        });
        return { data: r };
    }, { requireAuth: true });

    router.register(MessageType.CANCEL_MATCH, ({ conn }) => {
        const ok = matchService.cancel(conn.openid);
        return { data: { canceled: ok } };
    }, { requireAuth: true });

    // ---- 战斗 ----
    router.register(MessageType.BATTLE_START, ({ conn }) => {
        const room = roomManager.roomOf(conn.openid);
        if (!room) return _err(ErrorCode.NOT_FOUND);
        if (room.hostOpenid !== conn.openid) return _err(ErrorCode.FORBIDDEN, 'host only');
        if (room.battle) return _err(ErrorCode.DUPLICATE, 'already started');
        room.battle = new BattleSession({ room, roomManager, users, gachaServer });
        room.battle.start();
        return { data: { success: true } };
    }, { requireAuth: true });

    router.register(MessageType.FRAME_INPUT, ({ conn, data }) => {
        const room = roomManager.roomOf(conn.openid);
        if (!room || !room.battle) return;
        room.battle.onFrameInput(conn.openid, data.frameId, data.actions);
        // 不需要 reply
    }, { requireAuth: true });

    router.register('roll_dice', ({ conn, data }) => {
        const room = roomManager.roomOf(conn.openid);
        if (!room || !room.battle) return _err(ErrorCode.NOT_FOUND);
        const r = room.battle.rollDice(conn.openid, data.waveNumber || 0);
        return { data: r };
    }, { requireAuth: true });

    router.register('draw_gacha', async ({ conn, data }) => {
        const room = roomManager.roomOf(conn.openid);
        if (!room || !room.battle) return _err(ErrorCode.NOT_FOUND);
        const r = await room.battle.drawGacha(conn.openid, data.waveNumber || 0);
        return { data: r };
    }, { requireAuth: true });

    router.register(MessageType.STATE_HASH, ({ conn, data }) => {
        const room = roomManager.roomOf(conn.openid);
        if (!room || !room.battle) return;
        room.battle.reportStateHash(conn.openid, data.waveNumber, data.hash);
    }, { requireAuth: true });

    router.register(MessageType.GAME_OVER, async ({ conn, data }) => {
        const room = roomManager.roomOf(conn.openid);
        if (!room || !room.battle) return _err(ErrorCode.NOT_FOUND);
        // 仅房主上报有效
        if (room.hostOpenid !== conn.openid) return _err(ErrorCode.FORBIDDEN);
        await room.battle.settle(data);
        return { data: { success: true } };
    }, { requireAuth: true });

    router.register(MessageType.RECONNECT, ({ conn, data }) => {
        // 验签 token → 找到 openid → 重新绑定
        const payload = verifyToken(data.token, require('./config').config.jwtSecret);
        if (!payload || !payload.openid) return _err(ErrorCode.AUTH_FAIL);
        conn.openid = payload.openid;
        const room = roomManager.rebindConnection(conn.openid, conn.id);
        return { data: { success: true, room: room ? room.toJSON() : null } };
    });

    // ---- 聊天 ----
    router.register(MessageType.CHAT_MESSAGE, async ({ conn, data }) => {
        const r = await chatService.send({ openid: conn.openid, text: data.text, quickIdx: data.quickIdx });
        if (r.error) return _err(r.error, r.message);
        return { data: { success: true } };
    }, { requireAuth: true });

    // ---- 暂停（房主直接 / 队员投票，由客户端 PauseController 决策，服务端转发广播） ----
    router.register(MessageType.PAUSE_REQUEST, ({ conn, data }) => {
        const room = roomManager.roomOf(conn.openid);
        if (!room) return _err(ErrorCode.NOT_FOUND);
        roomManager.sendToRoom(room, {
            type: MessageType.PAUSE_REQUEST,
            timestamp: Date.now(),
            data: { initiator: conn.openid, isHost: room.hostOpenid === conn.openid, reason: data.reason },
        });
        return { data: { success: true } };
    }, { requireAuth: true });

    router.register(MessageType.PAUSE_VOTE, ({ conn, data }) => {
        const room = roomManager.roomOf(conn.openid);
        if (!room) return _err(ErrorCode.NOT_FOUND);
        roomManager.sendToRoom(room, {
            type: MessageType.PAUSE_VOTE,
            timestamp: Date.now(),
            data: { voter: conn.openid, agree: !!data.agree },
        });
        return { data: { success: true } };
    }, { requireAuth: true });

    router.register(MessageType.PAUSE_RESULT, ({ conn, data }) => {
        // 仅房主可发结果（最终是否暂停）
        const room = roomManager.roomOf(conn.openid);
        if (!room) return _err(ErrorCode.NOT_FOUND);
        if (room.hostOpenid !== conn.openid) return _err(ErrorCode.FORBIDDEN);
        roomManager.sendToRoom(room, {
            type: MessageType.PAUSE_RESULT,
            timestamp: Date.now(),
            data: { paused: !!data.paused, durationMs: data.durationMs, source: data.source },
        });
        return { data: { success: true } };
    }, { requireAuth: true });

    // ---- 观战 ----
    router.register(MessageType.SPECTATE_JOIN, ({ conn, data }) => {
        const targetRoom = roomManager.rooms.get(data.roomId);
        if (!targetRoom) return _err(ErrorCode.NOT_FOUND);
        targetRoom.spectators.add(conn.id);
        return { data: { success: true, room: targetRoom.toJSON() } };
    }, { requireAuth: true });

    router.register(MessageType.SPECTATE_LEAVE, ({ conn, data }) => {
        const targetRoom = roomManager.rooms.get(data.roomId);
        if (targetRoom) targetRoom.spectators.delete(conn.id);
        return { data: { success: true } };
    }, { requireAuth: true });

    // ---- 排行榜 ----
    router.register('get_leaderboard', async ({ data }) => {
        const list = await leaderboard.getTop(data.field || 'bestScore', data.limit || 100, data.offset || 0);
        return { data: { list } };
    });

    // ---- 埋点 ----
    router.register('analytics_batch', async ({ conn, data }) => {
        const r = await analytics.ingest(conn.openid || 'guest', data.events || []);
        return { data: r };
    });

    // ---- 心跳 ----
    router.register(MessageType.PING, ({ conn }) => {
        conn.send({ type: MessageType.PONG, timestamp: Date.now() });
    });
}

function _err(code, message) { return { data: { error: true, code, message } }; }

main().catch((e) => {
    Logger.error('Boot', 'fatal', e.stack || e.message);
    process.exit(1);
});
