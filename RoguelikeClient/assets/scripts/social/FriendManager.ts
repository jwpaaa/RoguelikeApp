/**
 * 好友列表（来自需求文档 §F-1.5）
 */

import { instance as EventBus } from '../core/EventBus';

export const FriendStatus = Object.freeze({
    ONLINE:    'online',
    IN_BATTLE: 'in_battle',
    OFFLINE:   'offline',
});

export type FriendStatusValue = typeof FriendStatus[keyof typeof FriendStatus];

export interface Friend {
    openid: string;
    nickname: string;
    avatar?: string;
    level?: number;
    status: FriendStatusValue;
    lastBattleTs?: number;
}

export type FriendFetcher = () => Promise<Friend[]>;

export class FriendManager {
    public fetcher: FriendFetcher | null;
    public list: Friend[] = [];

    constructor(ctx?: { fetcher?: FriendFetcher }) {
        this.fetcher = (ctx && ctx.fetcher) || null;
    }

    async fetchFriends(): Promise<Friend[]> {
        if (!this.fetcher) {
            this.list = [];
        } else {
            try { this.list = await this.fetcher(); }
            catch { this.list = []; }
        }
        this._sort();
        EventBus.emit('friend_list_update', this.list);
        return this.list;
    }

    setMockData(list: Friend[]): void {
        this.list = list || [];
        this._sort();
        EventBus.emit('friend_list_update', this.list);
    }

    private _sort(): void {
        const order: Record<FriendStatusValue, number> = {
            [FriendStatus.ONLINE]: 0,
            [FriendStatus.IN_BATTLE]: 1,
            [FriendStatus.OFFLINE]: 2,
        };
        this.list.sort((a, b) => (order[a.status] || 9) - (order[b.status] || 9));
    }

    async inviteToRoom(openid: string, roomId: string): Promise<void> {
        // lazy import 避免循环
        const { ShareManager } = await import('./ShareManager');
        ShareManager.shareRoom(roomId, '好友', undefined);
        EventBus.emit('friend_invited', { openid, roomId });
    }

    canSpectate(friend: Friend): boolean { return !!(friend && friend.status === FriendStatus.IN_BATTLE); }
}

export const instance = new FriendManager();
