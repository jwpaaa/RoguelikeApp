import { _decorator, Component, Button, Sprite, Color, Node, director, ScrollView } from 'cc';
import { UINode } from '../../scripts/ui/core/UINode';
import { TowerConfig, TowerType } from '../../shared/index';
import { EnemyConfig, BossConfig, EnemyType } from '../../shared/index';

const { ccclass, property } = _decorator;

const CARD_W = 200, CARD_H = 160;
const ICONS: Record<string, string> = {
    ARROW:'🏹', CANNON:'💣', ICE:'❄️', MAGIC:'🔮', TESLA:'⚡', POISON:'☠️', SUMMON:'🧙', TOTEM:'🗿',
    NORMAL:'👹', FAST:'🦅', FLYING:'🦇', TANK:'🦏', HEALER:'💚', SPLIT:'🧬', BOMBER:'💣',
    SHIELD:'🔵', STEALTH:'👻', SUMMONER:'📢', ELITE:'⭐',
    DRAGON:'👑', ROCK:'🗿', LICH:'💀', DEMON:'😈',
};

@ccclass('CollectionUI')
export class CollectionUI extends Component {

    @property(Button) btnBack: Button | null = null;
    @property(Button) tabTower: Button | null = null;
    @property(Button) tabEnemy: Button | null = null;
    @property(Node)   contentNode: Node | null = null;

    private _tab = 'tower';

    start(): void {
        if (this.btnBack) this.btnBack.node.on(Button.EventType.CLICK, () => director.loadScene('MainMenu'));
        if (this.tabTower) this.tabTower.node.on(Button.EventType.CLICK, () => { this._tab = 'tower'; this._refreshTabs(); this._render(); });
        if (this.tabEnemy) this.tabEnemy.node.on(Button.EventType.CLICK, () => { this._tab = 'enemy'; this._refreshTabs(); this._render(); });
        this._refreshTabs();
        this._render();
    }

    private _refreshTabs(): void {
        [this.tabTower, this.tabEnemy].forEach((t, i) => {
            if (!t) return;
            const sp = t.node.getComponent(Sprite);
            const active = (i === 0 && this._tab === 'tower') || (i === 1 && this._tab === 'enemy');
            if (sp) sp.color = new Color(active ? 74 : 44, active ? 144 : 62, active ? 226 : 80, 255);
        });
    }

    private _render(): void {
        if (!this.contentNode) return;
        UINode.clearChildren(this.contentNode);

        // 强制滚回顶部
        const sv = this.contentNode.parent?.getComponent(ScrollView);
        if (sv) sv.scrollToTop(0);

        const items: Array<{ key: string; name: string }> = [];
        if (this._tab === 'tower') {
            for (const t of Object.values(TowerType) as string[]) {
                items.push({ key: t, name: (TowerConfig as any)[t]?.name || t });
            }
        } else {
            for (const t of Object.values(EnemyType) as string[]) {
                items.push({ key: t, name: (EnemyConfig as any)[t]?.name || t });
            }
            for (const k of Object.keys(BossConfig)) {
                items.push({ key: k, name: (BossConfig as any)[k]?.name || k });
            }
        }

        const COLS = 3;
        for (let i = 0; i < items.length; i += COLS) {
            const row = new Node('Row_' + i);
            row.addComponent('cc.UITransform' as any)?.setContentSize(650, CARD_H);
            const ly = row.addComponent('cc.Layout' as any);
            if (ly) { ly.type = 1; ly.spacingX = 15; }

            for (let c = 0; c < COLS && i + c < items.length; c++) {
                const item = items[i + c];
                const card = UINode.panel({
                    name: 'Card_' + item.key,
                    size: { w: CARD_W, h: CARD_H },
                    color: '2C2C3EFF',
                });

                const { node: icon } = UINode.label({ text: ICONS[item.key] || '❓', fontSize: 36, color: 'FFFFFFFF', pos: { x: 0, y: 30 } });
                card.addChild(icon);
                const { node: nm } = UINode.label({ text: item.name, fontSize: 18, color: 'FFD700FF', pos: { x: 0, y: -10 } });
                card.addChild(nm);
                const { node: tp } = UINode.label({ text: this._tab === 'tower' ? '防御塔' : item.key.length > 6 ? 'BOSS' : '怪物', fontSize: 14, color: 'B4B4C8FF', pos: { x: 0, y: -40 } });
                card.addChild(tp);
                row.addChild(card);
            }
            this.contentNode!.addChild(row);
        }

        // 动态设 Content 高度 = 行数 × 行高
        const rows = Math.ceil(items.length / COLS);
        const h = rows * (CARD_H + 15) + 10;
        const uit = this.contentNode.getComponent('cc.UITransform' as any);
        if (uit) uit.height = Math.max(h, 400);
    }
}
