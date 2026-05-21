/**
 * 分享管理（来自需求文档 §F-1.2）
 */

declare const wx: undefined | {
    onShareAppMessage: (fn: () => { title: string; imageUrl?: string; query?: string }) => void;
    showShareMenu: (opts: { withShareTicket?: boolean; menus?: string[] }) => void;
    shareAppMessage: (opts: { title: string; imageUrl?: string; query?: string }) => void;
};

export interface ShareProvider {
    (): { title: string; imageUrl?: string; query?: string };
}

export class ShareManager {
    /** 注册 onShareAppMessage 回调（小游戏入口必须） */
    static register(provider: ShareProvider): void {
        if (typeof wx !== 'undefined' && wx.onShareAppMessage) {
            wx.onShareAppMessage(() => provider());
            if (wx.showShareMenu) {
                wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] });
            }
        }
    }

    static share({ title, imageUrl, query }: { title: string; imageUrl?: string; query?: string }): void {
        if (typeof wx !== 'undefined' && wx.shareAppMessage) {
            wx.shareAppMessage({ title, imageUrl, query });
        } else {
            console.log('[Share] mock share:', { title, query, imageUrl });
        }
    }

    static shareRoom(roomId: string, hostName: string, wave?: number): void {
        const title = `【${hostName}】邀请你一起保卫水晶${wave ? ' ' + wave + '波等你来战' : ''}！`;
        const query = `roomId=${roomId}`;
        ShareManager.share({ title, query });
    }

    static shareBattleReport({ grade, wave, score }: { grade: string; wave: number; score: number }): void {
        const title = `我在 RoguelikeTD 拿到了 ${grade} 评价！通关${wave}波，得分${score}`;
        ShareManager.share({ title, query: `share=report` });
    }
}
