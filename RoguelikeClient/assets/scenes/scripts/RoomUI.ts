import { _decorator, Component, Button, Label, Sprite, Color, Node, director } from 'cc';

const { ccclass, property } = _decorator;

const MOCK_PLAYERS = [
    { name: '玩家1', isHost: true, ready: true },
    { name: '玩家2', isHost: false, ready: true },
    { name: '等待中...', isHost: false, ready: false, isEmpty: true },
    { name: '等待中...', isHost: false, ready: false, isEmpty: true },
];

@ccclass('RoomUI')
export class RoomUI extends Component {

    @property(Button) btnBack: Button | null = null;
    @property(Button) btnStart: Button | null = null;
    @property(Button) btnInvite: Button | null = null;
    @property(Label)  roomCode: Label | null = null;
    @property(Label)  difficulty: Label | null = null;

    @property(Node)   player1: Node | null = null;
    @property(Node)   player2: Node | null = null;
    @property(Node)   player3: Node | null = null;
    @property(Node)   player4: Node | null = null;

    private _players = MOCK_PLAYERS;

    start(): void {
        if (this.roomCode) this.roomCode.string = '房间号: 123456';
        if (this.difficulty) this.difficulty.string = '难度: 中等';

        if (this.btnBack) {
            this.btnBack.node.on(Button.EventType.CLICK, () => director.loadScene('MainMenu'));
        }
        if (this.btnStart) {
            this.btnStart.node.on(Button.EventType.CLICK, () => {
                console.log('[Room] 开始游戏');
                director.loadScene('Battle');
            });
        }
        if (this.btnInvite) {
            this.btnInvite.node.on(Button.EventType.CLICK, () => {
                console.log('[Room] 邀请好友');
            });
        }

        this._refreshPlayers();
    }

    private _refreshPlayers(): void {
        const slots = [this.player1, this.player2, this.player3, this.player4];
        for (let i = 0; i < 4; i++) {
            const slot = slots[i];
            if (!slot) continue;

            if (i < this._players.length) {
                const p = this._players[i];
                slot.active = true;

                const children = slot.children;
                // children: Avatar(0), Name(1), Status(2), ReadyIcon(3)
                this._setLabel(children, 1, p.name, new Color(255, 255, 255, 255));
                this._setLabel(children, 2, p.isHost ? '👑 房主' : '队员', p.isHost ? new Color(255, 215, 0, 255) : new Color(180, 180, 200, 255));
                this._setLabel(children, 3, p.isEmpty ? '' : p.ready ? '✅ 已准备' : '⏳ 未准备',
                    p.ready ? new Color(46, 204, 113, 255) : new Color(149, 165, 166, 255));

                const sp = slot.getComponent(Sprite);
                if (sp) sp.color = p.isEmpty ? new Color(44, 44, 62, 100) : new Color(44, 44, 62, 255);
            } else {
                slot.active = false;
            }
        }
    }

    private _setLabel(children: Node[], idx: number, text: string, color: Color): void {
        if (idx < children.length) {
            const lbl = children[idx].getComponent(Label);
            if (lbl) { lbl.string = text; lbl.color = color; }
        }
    }
}
