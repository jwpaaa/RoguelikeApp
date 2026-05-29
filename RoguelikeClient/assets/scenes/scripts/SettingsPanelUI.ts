import { _decorator, Component, Button, Label, Color, Sprite } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('SettingsPanelUI')
export class SettingsPanelUI extends Component {

    @property(Button) masterDown: Button | null = null;
    @property(Button) masterUp: Button | null = null;
    @property(Label)  masterVal: Label | null = null;
    @property(Button) bgmDown: Button | null = null;
    @property(Button) bgmUp: Button | null = null;
    @property(Label)  bgmVal: Label | null = null;
    @property(Button) sfxDown: Button | null = null;
    @property(Button) sfxUp: Button | null = null;
    @property(Label)  sfxVal: Label | null = null;
    @property(Button) fastToggle: Button | null = null;
    @property(Label)  fastStatus: Label | null = null;
    @property(Button) skipToggle: Button | null = null;
    @property(Label)  skipStatus: Label | null = null;
    @property(Button) shakeToggle: Button | null = null;
    @property(Label)  shakeStatus: Label | null = null;
    @property(Button) btnClose: Button | null = null;

    private _master = 100;
    private _bgm = 80;
    private _sfx = 80;
    private _fast = false;
    private _skip = false;
    private _shake = true;

    start(): void {
        if (this.masterDown) this.masterDown.node.on(Button.EventType.CLICK, () => { this._master = Math.max(0, this._master - 10); this._refreshAll(); });
        if (this.masterUp)   this.masterUp.node.on(Button.EventType.CLICK,   () => { this._master = Math.min(100, this._master + 10); this._refreshAll(); });
        if (this.bgmDown)    this.bgmDown.node.on(Button.EventType.CLICK,    () => { this._bgm = Math.max(0, this._bgm - 10); this._refreshAll(); });
        if (this.bgmUp)      this.bgmUp.node.on(Button.EventType.CLICK,      () => { this._bgm = Math.min(100, this._bgm + 10); this._refreshAll(); });
        if (this.sfxDown)    this.sfxDown.node.on(Button.EventType.CLICK,    () => { this._sfx = Math.max(0, this._sfx - 10); this._refreshAll(); });
        if (this.sfxUp)      this.sfxUp.node.on(Button.EventType.CLICK,      () => { this._sfx = Math.min(100, this._sfx + 10); this._refreshAll(); });

        if (this.fastToggle)  this.fastToggle.node.on(Button.EventType.CLICK,  () => { this._fast = !this._fast; this._refreshAll(); });
        if (this.skipToggle)  this.skipToggle.node.on(Button.EventType.CLICK,  () => { this._skip = !this._skip; this._refreshAll(); });
        if (this.shakeToggle) this.shakeToggle.node.on(Button.EventType.CLICK, () => { this._shake = !this._shake; this._refreshAll(); });

        if (this.btnClose) this.btnClose.node.on(Button.EventType.CLICK, () => this.node.destroy());

        this._refreshAll();
    }

    private _refreshAll(): void {
        if (this.masterVal) this.masterVal.string = String(this._master);
        if (this.bgmVal)    this.bgmVal.string = String(this._bgm);
        if (this.sfxVal)    this.sfxVal.string = String(this._sfx);

        this._setToggle(this.fastToggle,  this.fastStatus,  this._fast);
        this._setToggle(this.skipToggle,  this.skipStatus,  this._skip);
        this._setToggle(this.shakeToggle, this.shakeStatus, this._shake);
    }

    private _setToggle(btn: Button | null, label: Label | null, v: boolean): void {
        const green = new Color(46, 204, 113, 255);
        const red   = new Color(231, 76, 60, 255);
        if (label) { label.string = v ? '开' : '关'; label.color = v ? green : red; }
        if (btn) {
            const sp = btn.node.getComponent(Sprite);
            if (sp) sp.color = v ? green : red;
        }
    }
}
