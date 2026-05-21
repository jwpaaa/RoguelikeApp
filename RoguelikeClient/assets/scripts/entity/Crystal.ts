/**
 * 水晶/萝卜（共享生命）
 * ---------------------------------------------------------------
 * 联机时全队共享同一个水晶；单机直接使用难度配置中的初始 HP。
 * 护盾抵消优先于生命扣减。
 */

export interface CrystalDamageResult {
    actual: number;
    dead: boolean;
}

export class Crystal {
    public maxHp: number;
    public hp: number;
    public shield: number;

    constructor(maxHp: number, shields: number = 0) {
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.shield = shields;
    }

    takeDamage(dmg: number): CrystalDamageResult {
        if (dmg <= 0) return { actual: 0, dead: false };
        let remaining = dmg;
        if (this.shield > 0) {
            const absorbed = Math.min(this.shield, remaining);
            this.shield -= absorbed;
            remaining -= absorbed;
        }
        this.hp = Math.max(0, this.hp - remaining);
        return { actual: dmg, dead: this.hp <= 0 };
    }

    heal(amount: number): void {
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }

    addShield(layers: number): void {
        this.shield += layers;
    }
}
