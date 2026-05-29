import { _decorator, Component, Button, Label, Sprite, Color, Node, director } from 'cc';
import { TalentConfig, TalentBranch } from '../../scripts/config/TalentConfig';
import { TalentDataManager } from '../../scripts/data/TalentDataManager';
import { instance as User } from '../../scripts/data/UserDataManager';
import { UINode } from '../../scripts/ui/core/UINode';
import type { TalentNode, TalentBranchValue } from '../../scripts/config/TalentConfig';

const { ccclass, property } = _decorator;

@ccclass('TalentTreeUI')
export class TalentTreeUI extends Component {

    @property(Label)   pointsLabel: Label | null = null;
    @property(Button)  btnReset: Button | null = null;
    @property(Node)    contentNode: Node | null = null;

    @property(Button)  tabAttack: Button | null = null;
    @property(Button)  tabDefense: Button | null = null;
    @property(Button)  tabLuck: Button | null = null;
    @property(Button)  btnBack: Button | null = null;

    private _currentBranch: TalentBranchValue = TalentBranch.ATTACK;

    start(): void {
        this._refreshTabs();
        this._renderList();

        if (this.btnBack) {
            this.btnBack.node.on(Button.EventType.CLICK, () => director.loadScene('MainMenu'));
        }
        if (this.btnReset) {
            this.btnReset.node.on(Button.EventType.CLICK, () => {
                User.resetTalents();
                this._renderList();
            });
        }
    }

    private _refreshTabs(): void {
        const tabs = [this.tabAttack, this.tabDefense, this.tabLuck];
        const branches = [TalentBranch.ATTACK, TalentBranch.DEFENSE, TalentBranch.LUCK];
        tabs.forEach((tab, i) => {
            if (!tab) return;
            const sp = tab.node.getComponent(Sprite);
            const isActive = branches[i] === this._currentBranch;
            if (sp) sp.color = new Color(isActive ? 74 : 44, isActive ? 144 : 62, isActive ? 226 : 80, 255);
            tab.node.off(Button.EventType.CLICK);
            tab.node.on(Button.EventType.CLICK, () => {
                this._currentBranch = branches[i];
                this._refreshTabs();
                this._renderList();
            });
        });
    }

    private _renderList(): void {
        if (!this.contentNode) return;
        UINode.clearChildren(this.contentNode);

        const branchTalents = TalentConfig[this._currentBranch] || [];
        const talents = User.data.talents || {};
        const availablePoints = User.level || 1;

        if (this.pointsLabel) {
            this.pointsLabel.string = `天赋点: ${availablePoints}`;
        }

        for (const node of branchTalents) {
            const level = talents[node.id] || 0;
            const maxed = level >= node.maxLevel;
            const cost = maxed ? -1 : node.costPerLevel[level];
            const canAfford = availablePoints >= cost;

            const card = UINode.panel({
                name: 'TalentCard',
                size: { w: 560, h: 80 },
                color: '2C2C3EFF',
            });
            this.contentNode.addChild(card);

            // 名称
            const { node: nameNode } = UINode.label({
                text: node.name,
                fontSize: 22,
                color: 'FFD700FF',
                pos: { x: -230, y: 20 },
            });
            card.addChild(nameNode);

            // 描述
            const { node: descNode } = UINode.label({
                text: node.desc,
                fontSize: 16,
                color: 'B4B4C8FF',
                pos: { x: -230, y: -10 },
            });
            card.addChild(descNode);

            // 等级
            const { node: lvNode } = UINode.label({
                text: `Lv.${level}/${node.maxLevel}`,
                fontSize: 16,
                color: 'FFFFFFFF',
                pos: { x: 160, y: 20 },
            });
            card.addChild(lvNode);

            // 升级按钮
            const btnText = maxed ? '已满' : `升级(${cost}点)`;
            const btn = UINode.button({
                text: btnText,
                size: { w: 100, h: 40 },
                pos: { x: 180, y: -10 },
                color: maxed || !canAfford ? '555555FF' : '4A90E2FF',
                textColor: 'FFFFFFFF',
                fontSize: 14,
                disabled: maxed || !canAfford,
                onClick: () => {
                    if (TalentDataManager.upgrade(node.id)) {
                        this._renderList();
                    }
                },
            });
            card.addChild(btn.node);
        }

        // 动态设 Content 高度消除底部留白
        const CARD_HEIGHT = 100;
        const totalH = branchTalents.length * CARD_HEIGHT;
        const uit = this.contentNode.getComponent('cc.UITransform' as any);
        if (uit) uit.setContentSize(600, Math.max(totalH, 400));
    }
}
