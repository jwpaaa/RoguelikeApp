/**
 * 消息类型常量（与客户端 assets/scripts/network/MessageProtocol.js 必须严格一致）
 * ---------------------------------------------------------------
 * 若需修改：同时修改两边并加版本号。
 */

'use strict';

const MessageType = Object.freeze({
    AUTH_LOGIN:        'auth_login',
    AUTH_RSP:          'auth_rsp',

    CREATE_ROOM:       'create_room',
    JOIN_ROOM:         'join_room',
    LEAVE_ROOM:        'leave_room',
    KICK_PLAYER:       'kick_player',
    ROOM_UPDATE:       'room_update',

    START_MATCH:       'start_match',
    CANCEL_MATCH:      'cancel_match',
    MATCH_RSP:         'match_rsp',

    PLAYER_READY:      'player_ready',
    ALL_READY:         'all_ready',

    BATTLE_START:      'battle_start',
    FRAME_INPUT:       'frame_input',
    FRAME_BROADCAST:   'frame_broadcast',

    WAVE_START:        'wave_start',
    WAVE_END:          'wave_end',

    DICE_RESULT:       'dice_result',
    GACHA_RESULT:      'gacha_result',

    SHOP_OPEN:         'shop_open',
    SHOP_BUY:          'shop_buy',
    SHOP_REFRESH:      'shop_refresh',

    PAUSE_REQUEST:     'pause_request',
    PAUSE_VOTE:        'pause_vote',
    PAUSE_RESULT:      'pause_result',

    CHAT_MESSAGE:      'chat_message',

    SPECTATE_JOIN:     'spectate_join',
    SPECTATE_FRAME:    'spectate_frame',
    SPECTATE_LEAVE:    'spectate_leave',

    GAME_OVER:         'game_over',

    PLAYER_DISCONNECT: 'player_disconnect',
    RECONNECT:         'reconnect',
    HOST_TRANSFER:     'host_transfer',

    STATE_HASH:        'state_hash',
    STATE_DESYNC:      'state_desync',

    PING:              'ping',
    PONG:              'pong',

    ERROR:             'error',
});

const ErrorCode = Object.freeze({
    AUTH_FAIL:    'AUTH_FAIL',
    BAD_PAYLOAD:  'BAD_PAYLOAD',
    UNAUTHORIZED: 'UNAUTHORIZED',
    NOT_FOUND:    'NOT_FOUND',
    FORBIDDEN:    'FORBIDDEN',
    BUSY:         'BUSY',
    INTERNAL:     'INTERNAL',
    DUPLICATE:    'DUPLICATE',
    LIMIT:        'LIMIT',
});

module.exports = { MessageType, ErrorCode };
