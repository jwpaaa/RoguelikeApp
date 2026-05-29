import { _decorator, Component, Button, Label, Sprite, Color, Node, director } from 'cc';
import { UINode } from '../../scripts/ui/core/UINode';

const { ccclass, property } = _decorator;

const MOCK_DATA = [
    { rank: 1, name: '塔防高手', score: 20, highlight: true },
    { rank: 2, name: '肉鸽之王', score: 18 },
    { rank: 3, name: '水晶守护者', score: 16 },
    { rank: 4, name: '怪物猎人', score: 14 },
    { rank: 5, name: '策略大师', score: 13 },
    { rank: 6, name: '新手玩家', score: 10, isMe: true },
    { rank: 7, name: '休闲玩家', score: 8 },
    { rank: 8, name: '测试账号', score: 5 },
];

@ccclass('LeaderboardUI')
export class LeaderboardUI extends Component {

    @property(Button) btnBack: Button | null = null;
    @property(Button) tabWave: Button | null = null;
    @property(Button) tabKill: Button | null = null;
    @property(Node)   contentNode: Node | null = null;

    private _sortBy = 'wave';

    start(): void {
        if (this.btnBack) {
            this.btnBack.node.on(Button.EventType.CLICK, () => director.loadScene('MainMenu'));
        }
        if (this.tabWave) {
            this.tabWave.node.on(Button.EventType.CLICK, () => { this._sortBy = 'wave'; this._render(); });
        }
        if (this.tabKill) {
            this.tabKill.node.on(Button.EventType.CLICK, () => { this._sortBy = 'kill'; this._render(); });
        }
        this._render();
    }

    private _render(): void {
        if (!this.contentNode) return;
        UINode.clearChildren(this.contentNode);

        const tabs = [this.tabWave, this.tabKill];
        tabs.forEach((t, i) => {
            if (!t) return;
            const sp = t.node.getComponent(Sprite);
            const active = (i === 0 && this._sortBy === 'wave') || (i === 1 && this._sortBy === 'kill');
            if (sp) sp.color = new Color(active ? 74 : 44, active ? 144 : 62, active ? 226 : 80, 255);
        });

        const data = [...MOCK_DATA];

        for (const item of data) {
            const row = UINode.panel({
                name: 'RankRow',
                size: { w: 580, h: 60 },
                color: item.isMe ? '3A4A6EFF' : item.highlight ? '2C2C3EE0' : '2C2C3E80',
            });
            this.contentNode.addChild(row);

            // 排名
            const rankStr = item.rank <= 3 ? ['🥇','🥈','🥉'][item.rank - 1] : `#${item.rank}`;
            const { node: rankNode } = UINode.label({
                text: rankStr,
                fontSize: 20,
                color: 'FFFFFFFF',
                pos: { x: -230, y: 0 },
            });
            row.addChild(rankNode);

            // 玩家名
            const { node: nameNode } = UINode.label({
                text: item.name + (item.isMe ? ' (你)' : ''),
                fontSize: 20,
                color: item.isMe ? 'FFD700FF' : 'FFFFFFFF',
                pos: { x: -80, y: 0 },
            });
            row.addChild(nameNode);

            // 成绩
            const scoreStr = this._sortBy === 'wave' ? `${item.score} 波` : `${item.score * 12} 击杀`;
            const { node: scoreNode } = UINode.label({
                text: scoreStr,
                fontSize: 20,
                color: '4A90E2FF',
                pos: { x: 200, y: 0 },
            });
            row.addChild(scoreNode);
        }

        // 消除底部留白
        const totalH = data.length * 68;
        const uit = this.contentNode.getComponent('cc.UITransform' as any);
        if (uit) uit.setContentSize(600, Math.max(totalH, 400));
    }
}
