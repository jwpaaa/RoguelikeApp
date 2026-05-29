import { _decorator, Component, Button, Label, Sprite, Color, Node, director } from 'cc';
import { UINode } from '../../scripts/ui/core/UINode';
import { TowerConfig, TowerType } from '../../shared/index';
import { EnemyConfig, BossConfig, EnemyType } from '../../shared/index';

const { ccclass, property } = _decorator;

const CARD_W = 200, CARD_H = 160, GAP_X = 15, GAP_Y = 175;
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

        const cols = 3;
        const startX = -(cols - 1) * (CARD_W + GAP_X) / 2;

        items.forEach((item, idx) => {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            const card = UINode.panel({
                name: 'Card_' + item.key,
                size: { w: CARD_W, h: CARD_H },
                color: '2C2C3EFF',
                pos: { x: startX + col * (CARD_W + GAP_X), y: -row * GAP_Y - 10 },
                anchor: { x: 0.5, y: 1 },
            });

            const { node: icon } = UINode.label({ text: ICONS[item.key] || '❓', fontSize: 36, color: 'FFFFFFFF', pos: { x: 0, y: 30 } });
            card.addChild(icon);

            const { node: nm } = UINode.label({ text: item.name, fontSize: 18, color: 'FFD700FF', pos: { x: 0, y: -10 } });
            card.addChild(nm);

            const { node: tp } = UINode.label({ text: this._tab === 'tower' ? '防御塔' : item.key.length > 6 ? 'BOSS' : '怪物', fontSize: 14, color: 'B4B4C8FF', pos: { x: 0, y: -40 } });
            card.addChild(tp);

            this.contentNode!.addChild(card);
        });

        const rows = Math.ceil(items.length / cols);
        const h = rows * GAP_Y + 30;
        const uit = this.contentNode.getComponent('cc.UITransform' as any);
        if (uit) uit.setContentSize(650, Math.max(h, 450));
    }
}
