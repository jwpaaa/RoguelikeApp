"use strict";
/**
 * Cocos Creator API Mock（仅用于 Node 测试环境）
 * ---------------------------------------------------------------
 * 仅实现 UI 层用到的最小 API：Node / Component / Label / Sprite /
 * UITransform / Button / Layout / Mask / Color / director / instantiate
 *
 * 真实 Cocos 工程不会用到这个文件 — 由 tsconfig.tools.json 的 paths 映射注入。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports._MOCK = exports.director = exports.Color = exports.Mask = exports.Layout = exports.Button = exports.UITransform = exports.Sprite = exports.Label = exports.Component = exports.Node = void 0;
exports.instantiate = instantiate;
class Node {
    constructor(name) {
        this.children = [];
        this.parent = null;
        this.active = true;
        this.position = { x: 0, y: 0, z: 0 };
        this.scale = { x: 1, y: 1, z: 1 };
        this.angle = 0;
        this.layer = 0;
        this._components = [];
        this._listeners = new Map();
        this.name = name || 'Node';
    }
    addChild(child) {
        this.children.push(child);
        child.parent = this;
        return child;
    }
    removeFromParent() {
        if (!this.parent)
            return;
        const i = this.parent.children.indexOf(this);
        if (i >= 0)
            this.parent.children.splice(i, 1);
        this.parent = null;
    }
    destroy() { this.removeFromParent(); }
    setPosition(x, y, z) {
        this.position.x = x;
        this.position.y = y;
        if (z !== undefined)
            this.position.z = z;
    }
    getPosition() { return this.position; }
    setScale(x, y) {
        this.scale.x = x;
        this.scale.y = y === undefined ? x : y;
    }
    setSiblingIndex(_i) { }
    addComponent(Ctor) {
        const c = new Ctor();
        c.node = this;
        this._components.push(c);
        return c;
    }
    getComponent(Ctor) {
        for (const c of this._components)
            if (c instanceof Ctor)
                return c;
        return null;
    }
    getComponentsInChildren(Ctor) {
        const out = [];
        const visit = (n) => {
            for (const c of n._components)
                if (c instanceof Ctor)
                    out.push(c);
            for (const ch of n.children)
                visit(ch);
        };
        visit(this);
        return out;
    }
    on(event, cb) {
        if (!this._listeners.has(event))
            this._listeners.set(event, []);
        this._listeners.get(event).push(cb);
    }
    off(event, cb) {
        if (!cb) {
            this._listeners.delete(event);
            return;
        }
        const list = this._listeners.get(event);
        if (!list)
            return;
        const i = list.indexOf(cb);
        if (i >= 0)
            list.splice(i, 1);
    }
    emit(event, ...args) {
        const list = this._listeners.get(event);
        if (!list)
            return;
        for (const cb of list.slice())
            cb(...args);
    }
}
exports.Node = Node;
class Component {
    constructor() {
        this.node = new Node();
        this.enabled = true;
    }
}
exports.Component = Component;
class Label extends Component {
    constructor() {
        super(...arguments);
        this.string = '';
        this.fontSize = 22;
        this.color = null;
    }
}
exports.Label = Label;
class Sprite extends Component {
    constructor() {
        super(...arguments);
        this.spriteFrame = null;
        this.color = null;
    }
}
exports.Sprite = Sprite;
class UITransform extends Component {
    constructor() {
        super(...arguments);
        this.width = 0;
        this.height = 0;
        this.anchorX = 0.5;
        this.anchorY = 0.5;
    }
    setContentSize(w, h) { this.width = w; this.height = h; }
    setAnchorPoint(x, y) { this.anchorX = x; this.anchorY = y; }
}
exports.UITransform = UITransform;
class Button extends Component {
    constructor() {
        super(...arguments);
        this.transition = 1;
    }
}
exports.Button = Button;
class Layout extends Component {
    constructor() {
        super(...arguments);
        this.type = 0;
        this.spacingX = 0;
        this.spacingY = 0;
    }
}
exports.Layout = Layout;
class Mask extends Component {
}
exports.Mask = Mask;
class Color {
    constructor(r, g, b, a) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a == null ? 255 : a;
    }
    static fromHEX(hex) {
        const r = (hex >> 24) & 0xFF;
        const g = (hex >> 16) & 0xFF;
        const b = (hex >> 8) & 0xFF;
        const a = hex & 0xFF;
        return new Color(r, g, b, a);
    }
}
exports.Color = Color;
exports.director = {
    getScene: () => new Node('Scene'),
};
function instantiate(n) {
    const copy = new Node(n.name);
    for (const c of n.children)
        copy.addChild(instantiate(c));
    return copy;
}
/** 标识：让 CocosAdapter 知道这是 mock 版本 */
exports._MOCK = true;
