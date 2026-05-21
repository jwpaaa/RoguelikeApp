/**
 * 召唤塔小兵实体
 * ---------------------------------------------------------------
 * 小兵不沿路径走，而是站在塔附近"阻挡"路径上的怪物。
 */

let _seq = 1;
function nextId(): string { return `m_${_seq++}`; }

export interface MinionInit {
    ownerId: string;
    towerId: string;
    x: number;
    y: number;
    hp: number;
    atk: number;
    taunt?: boolean;
    suicide?: boolean;
}

export class Minion {
    public id: string;
    public ownerId: string;
    public towerId: string;
    public x: number;
    public y: number;
    public maxHp: number;
    public hp: number;
    public atk: number;
    public taunt: boolean;
    public suicide: boolean;
    public cooldownMs: number = 0;
    public dead: boolean = false;

    constructor(init: MinionInit) {
        this.id = nextId();
        this.ownerId = init.ownerId;
        this.towerId = init.towerId;
        this.x = init.x;
        this.y = init.y;
        this.maxHp = init.hp;
        this.hp = init.hp;
        this.atk = init.atk;
        this.taunt = !!init.taunt;
        this.suicide = !!init.suicide;
    }
}
