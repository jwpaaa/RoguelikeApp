/**
 * 客户端 / 服务端共享：WebSocket 消息类型常量
 * ---------------------------------------------------------------
 * 严格一致：任何修改必须同时反映到客户端 NetworkClient 和服务端 Router。
 */

export const MessageType = {
    // 账号
    AUTH_LOGIN:        'auth_login',
    AUTH_RSP:          'auth_rsp',
    // 房间
    CREATE_ROOM:       'create_room',
    JOIN_ROOM:         'join_room',
    LEAVE_ROOM:        'leave_room',
    KICK_PLAYER:       'kick_player',
    ROOM_UPDATE:       'room_update',
    // 匹配
    START_MATCH:       'start_match',
    CANCEL_MATCH:      'cancel_match',
    MATCH_RSP:         'match_rsp',
    // 准备
    PLAYER_READY:      'player_ready',
    ALL_READY:         'all_ready',
    // 战斗
    BATTLE_START:      'battle_start',
    FRAME_INPUT:       'frame_input',
    FRAME_BROADCAST:   'frame_broadcast',
    // 波次
    WAVE_START:        'wave_start',
    WAVE_END:          'wave_end',
    // 骰子/抽卡
    DICE_RESULT:       'dice_result',
    GACHA_RESULT:      'gacha_result',
    // 商店
    SHOP_OPEN:         'shop_open',
    SHOP_BUY:          'shop_buy',
    SHOP_REFRESH:      'shop_refresh',
    // 暂停
    PAUSE_REQUEST:     'pause_request',
    PAUSE_VOTE:        'pause_vote',
    PAUSE_RESULT:      'pause_result',
    // 聊天
    CHAT_MESSAGE:      'chat_message',
    // 观战
    SPECTATE_JOIN:     'spectate_join',
    SPECTATE_FRAME:    'spectate_frame',
    SPECTATE_LEAVE:    'spectate_leave',
    // 结算
    GAME_OVER:         'game_over',
    // 断线
    PLAYER_DISCONNECT: 'player_disconnect',
    RECONNECT:         'reconnect',
    HOST_TRANSFER:     'host_transfer',
    // 一致性
    STATE_HASH:        'state_hash',
    STATE_DESYNC:      'state_desync',
    // 心跳
    PING:              'ping',
    PONG:              'pong',
    // 通用错误
    ERROR:             'error',
} as const;

export type MessageTypeValue = typeof MessageType[keyof typeof MessageType];

export const ActionType = {
    PLACE_TOWER:        'PLACE_TOWER',
    UPGRADE_TOWER:      'UPGRADE_TOWER',
    SELL_TOWER:         'SELL_TOWER',
    USE_ITEM:           'USE_ITEM',
    SELECT_TOWER_PICK:  'SELECT_TOWER_PICK',
    SWITCH_TARGET_MODE: 'SWITCH_TARGET_MODE',
    SHOP_BUY:           'SHOP_BUY',
    SHOP_REFRESH:       'SHOP_REFRESH',
    SHOP_CLOSE:         'SHOP_CLOSE',
    GIFT_GOLD:          'GIFT_GOLD',
    PING_MAP:           'PING_MAP',
    EMPTY:              'EMPTY',
} as const;

export type ActionTypeValue = typeof ActionType[keyof typeof ActionType];

export const ErrorCode = {
    AUTH_FAIL:    'AUTH_FAIL',
    BAD_PAYLOAD:  'BAD_PAYLOAD',
    UNAUTHORIZED: 'UNAUTHORIZED',
    NOT_FOUND:    'NOT_FOUND',
    FORBIDDEN:    'FORBIDDEN',
    BUSY:         'BUSY',
    INTERNAL:     'INTERNAL',
    DUPLICATE:    'DUPLICATE',
    LIMIT:        'LIMIT',
} as const;

export type ErrorCodeValue = typeof ErrorCode[keyof typeof ErrorCode];

/** WebSocket 消息的统一信封 */
export interface WsMessage<T = unknown> {
    type: string;
    seq?: number;
    timestamp: number;
    data?: T;
}

/** 玩家在帧内的一个操作 */
export interface PlayerAction {
    type: ActionTypeValue;
    pid?: string;
    [key: string]: unknown;
}
