/**
 * Cocos Creator API Mock（仅用于 Node 测试环境）
 * ---------------------------------------------------------------
 * 仅实现 UI 层用到的最小 API：Node / Component / Label / Sprite /
 * UITransform / Button / Layout / Mask / Color / director / instantiate
 *
 * 真实 Cocos 工程不会用到这个文件 — 由 tsconfig.tools.json 的 paths 映射注入。
 */

export class Node {
    public name: string;
    public children: Node[] = [];
    public parent: Node | null = null;
    public active: boolean = true;
    public position = { x: 0, y: 0, z: 0 };
    public scale = { x: 1, y: 1, z: 1 };
    public angle: number = 0;
    public layer: number = 0;
    private _components: Component[] = [];
    private _listeners: Map<string, Array<(...args: unknown[]) => void>> = new Map();

    constructor(name?: string) { this.name = name || 'Node'; }

    addChild(child: Node): Node {
        this.children.push(child);
        child.parent = this;
        return child;
    }

    removeFromParent(): void {
        if (!this.parent) return;
        const i = this.parent.children.indexOf(this);
        if (i >= 0) this.parent.children.splice(i, 1);
        this.parent = null;
    }

    destroy(): void { this.removeFromParent(); }
    setPosition(x: number, y: number, z?: number): void {
        this.position.x = x; this.position.y = y;
        if (z !== undefined) this.position.z = z;
    }
    getPosition() { return this.position; }
    setScale(x: number, y?: number): void {
        this.scale.x = x;
        this.scale.y = y === undefined ? x : y;
    }
    setSiblingIndex(_i: number): void { /* mock */ }

    addComponent<T extends Component>(Ctor: new () => T): T {
        const c = new Ctor();
        c.node = this;
        this._components.push(c);
        return c;
    }

    getComponent<T extends Component>(Ctor: new () => T): T | null {
        for (const c of this._components) if (c instanceof Ctor) return c as T;
        return null;
    }

    getComponentsInChildren<T extends Component>(Ctor: new () => T): T[] {
        const out: T[] = [];
        const visit = (n: Node): void => {
            for (const c of (n as any)._components as Component[]) if (c instanceof Ctor) out.push(c as T);
            for (const ch of n.children) visit(ch);
        };
        visit(this);
        return out;
    }

    on(event: string, cb: (...args: unknown[]) => void): void {
        if (!this._listeners.has(event)) this._listeners.set(event, []);
        this._listeners.get(event)!.push(cb);
    }
    off(event: string, cb?: (...args: unknown[]) => void): void {
        if (!cb) { this._listeners.delete(event); return; }
        const list = this._listeners.get(event);
        if (!list) return;
        const i = list.indexOf(cb);
        if (i >= 0) list.splice(i, 1);
    }
    emit(event: string, ...args: unknown[]): void {
        const list = this._listeners.get(event);
        if (!list) return;
        for (const cb of list.slice()) cb(...args);
    }
}

export class Component {
    public node: Node = new Node();
    public enabled: boolean = true;
}

export class Label extends Component {
    public string: string = '';
    public fontSize: number = 22;
    public color: Color | null = null;
}

export class Sprite extends Component {
    public spriteFrame: unknown = null;
    public color: Color | null = null;
}

export class UITransform extends Component {
    public width: number = 0;
    public height: number = 0;
    public anchorX: number = 0.5;
    public anchorY: number = 0.5;
    setContentSize(w: number, h: number): void { this.width = w; this.height = h; }
    setAnchorPoint(x: number, y: number): void { this.anchorX = x; this.anchorY = y; }
}

export class Button extends Component {
    public transition: number = 1;
}

export class Layout extends Component {
    public type: number = 0;
    public spacingX: number = 0;
    public spacingY: number = 0;
}

export class Mask extends Component {}

export class Color {
    public r: number;
    public g: number;
    public b: number;
    public a: number;

    constructor(r: number, g: number, b: number, a?: number) {
        this.r = r; this.g = g; this.b = b; this.a = a == null ? 255 : a;
    }

    static fromHEX(hex: number): Color {
        const r = (hex >> 24) & 0xFF;
        const g = (hex >> 16) & 0xFF;
        const b = (hex >>  8) & 0xFF;
        const a = hex & 0xFF;
        return new Color(r, g, b, a);
    }
}

export const director = {
    getScene: (): Node => new Node('Scene'),
};

export function instantiate(n: Node): Node {
    const copy = new Node(n.name);
    for (const c of n.children) copy.addChild(instantiate(c));
    return copy;
}

/** 标识：让 CocosAdapter 知道这是 mock 版本 */
export const _MOCK = true;
