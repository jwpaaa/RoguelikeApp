/**
 * 子弹（弹道）实体
 * ---------------------------------------------------------------
 * 子弹"瞬时命中"模型：仅作为伤害事件包装，由 BulletController
 * 直接结算；视觉表现由渲染层根据弹道动画播放。
 */

import type { DamageTypeStr } from './Enemy';

let _seq = 1;
function nextId(): string { return `b_${_seq++}`; }

export interface BulletInit {
    shooterId: string;
    ownerId: string;
    targetId?: string | null;
    tx?: number;
    ty?: number;
    dmg?: number;
    dmgType?: DamageTypeStr;
    splash?: number;
    pierce?: number;
    chain?: number;
    chainDecay?: number;
    crit?: boolean;
    effects?: Record<string, unknown> | null;
}

export class Bullet {
    public id: string;
    public shooterId: string;
    public ownerId: string;
    public targetId: string | null;
    public tx: number;
    public ty: number;
    public dmg: number;
    public dmgType: DamageTypeStr;
    public splash: number;
    public pierce: number;
    public chain: number;
    public chainDecay: number;
    public crit: boolean;
    public effects: Record<string, unknown> | null;

    constructor(init: BulletInit) {
        this.id         = nextId();
        this.shooterId  = init.shooterId;
        this.ownerId    = init.ownerId;
        this.targetId   = init.targetId || null;
        this.tx         = init.tx || 0;
        this.ty         = init.ty || 0;
        this.dmg        = init.dmg || 0;
        this.dmgType    = init.dmgType || 'PHYSICAL';
        this.splash     = init.splash || 0;
        this.pierce     = init.pierce || 0;
        this.chain      = init.chain || 0;
        this.chainDecay = init.chainDecay || 0;
        this.crit       = !!init.crit;
        this.effects    = init.effects || null;
    }
}
