/**
 * 战斗总控 BattleManager
 * ---------------------------------------------------------------
 * 状态机：
 *   PREPARE  → 等待玩家放第一个塔（教学关 / 倒计时）
 *   FIGHTING → 波次进行中
 *   WAVE_END → 波次结束 → 事件队列：成长/商店/骰子/抽卡/三选一
 *   FINISHED → 胜利或失败
 */

import { SeededRandom } from '../utils/SeededRandom';
import { MapGenerator, type GameMap } from '../map/MapGenerator';
import { TowerType, type TowerTypeValue } from '../../shared/index';
import { DifficultyConfig, MultiplayerConfig, type DifficultyValue } from '../config/DifficultyConfig';
import { TOTAL_WAVES, isBossWave, getWaveRewardGold } from '../config/WaveConfig';
import { ItemType } from '../config/ItemConfig';
import { Crystal } from '../entity/Crystal';
import { EntityManager } from './EntityManager';
import { EconomyManager } from './EconomyManager';
import { BuffManager } from './BuffManager';
import { TowerController } from './TowerController';
import { EnemyController } from './EnemyController';
import { BulletController } from './BulletController';
import { WaveController } from './WaveController';
import { TowerAI } from './TowerAI';
import { ItemController } from './ItemController';
import { ShopController } from './ShopController';
import { PauseController } from './PauseController';
import { DamagePopupManager } from './DamagePopupManager';
import { TowerGrowthSystem } from '../roguelike/TowerGrowthSystem';
import { DiceSystem } from '../roguelike/DiceSystem';
import { GachaSystem } from '../roguelike/GachaSystem';
import { TowerPickSystem } from '../roguelike/TowerPickSystem';
import { RandomEventSystem } from '../roguelike/RandomEventSystem';
import { Minion } from '../entity/Minion';
import { instance as EventBus } from '../core/EventBus';
import { Logger } from '../utils/Logger';
import type { Tower, GlobalMod, AuraMod } from '../entity/Tower';
import type { TargetModeValue } from '../../shared/index';

export const State = Object.freeze({
    PREPARE:   'PREPARE',
    FIGHTING:  'FIGHTING',
    WAVE_END:  'WAVE_END',
    FINISHED:  'FINISHED',
});

export type StateValue = typeof State[keyof typeof State];

export interface TalentEffects {
    startGold?: number;
    crystalHp?: number;
    buildDiscount?: number;
    shieldBonus?: number;
    diceGoodPct?: number;
    gachaSrPct?: number;
    allyDebuffResist?: number;
    globalAtkPct?: number;
    globalCritPct?: number;
    unlockTargetMode?: boolean;
}

export interface BattleCfg {
    seed: number;
    difficulty: DifficultyValue;
    players: Array<{ id: string; name?: string }>;
    talentEffects?: TalentEffects;
    /** 联机模式下注入；不传则单机模式 */
    net?: {
        isOnline(): boolean;
        send(type: string, data: unknown): Promise<unknown>;
        sendFireAndForget(type: string, data: unknown): void;
        openid: string | null;
    } | null;
}

export interface BattleStats {
    kills: number;
    leaks: number;
    totalGoldEarned: number;
}

export interface ScoreResult {
    score: number;
    grade: string;
}

export interface BattleEndResult {
    win: boolean;
    wave: number;
    kills: number;
    leaks: number;
    crystalHp: number;
    totalGold: number;
    score: ScoreResult;
}

export class BattleManager {
    public seed: number;
    public difficulty: DifficultyValue;
    public players: Array<{ id: string; name?: string }>;
    public talents: TalentEffects;
    public diff: typeof DifficultyConfig[DifficultyValue];
    public mp: typeof MultiplayerConfig[1 | 2 | 3 | 4];

    public mapRng: SeededRandom;
    public monsterRng: SeededRandom;
    public diceRng: SeededRandom;
    public gachaRng: SeededRandom;
    public battleRng: SeededRandom;

    public map: GameMap;
    public em: EntityManager;
    public economy: EconomyManager;
    public buffs: BuffManager;
    public unlockedTowers: Map<string, Set<TowerTypeValue>>;
    public towerLimit: Map<string, number>;
    public crystal: Crystal;

    public towerCtl: TowerController;
    public bulletCtl: BulletController;
    public enemyCtl: EnemyController;
    public waveCtl: WaveController;
    public growthSys: TowerGrowthSystem;
    public diceSys: DiceSystem;
    public gachaSys: GachaSystem;
    public pickSys: TowerPickSystem;

    public itemCtl: ItemController;
    public shopCtl: ShopController;
    public randomEvtSys: RandomEventSystem;
    public pauseCtl: PauseController;
    public popups: DamagePopupManager;

    public stats: BattleStats;
    public state: StateValue;
    public currentWave: number = 0;
    private _towerAcc: Map<string, number> = new Map();
    private _logicFrameId: number = 0;

    constructor(cfg: BattleCfg) {
        this.seed = cfg.seed | 0;
        this.difficulty = cfg.difficulty || 2;
        this.players = cfg.players;
        this.talents = cfg.talentEffects || {};

        this.diff = DifficultyConfig[this.difficulty];
        const mpCount = Math.min(4, Math.max(1, this.players.length)) as 1 | 2 | 3 | 4;
        this.mp = MultiplayerConfig[mpCount];

        // 派生种子（来自技术文档_02 §1.3）
        this.mapRng     = new SeededRandom(SeededRandom.hash(this.seed + ':map'));
        this.monsterRng = new SeededRandom(SeededRandom.hash(this.seed + ':monster'));
        this.diceRng    = new SeededRandom(SeededRandom.hash(this.seed + ':dice'));
        this.gachaRng   = new SeededRandom(SeededRandom.hash(this.seed + ':gacha'));
        this.battleRng  = new SeededRandom(SeededRandom.hash(this.seed + ':battle'));

        this.map = new MapGenerator().generate(this.mapRng.seed);

        this.em = new EntityManager();
        this.economy = new EconomyManager();
        this.buffs = new BuffManager();
        this.unlockedTowers = new Map();
        this.towerLimit = new Map();

        const crystalHp = this.diff.crystalHp + (this.talents.crystalHp || 0);
        this.crystal = new Crystal(crystalHp);
        this.em.setCrystal(this.crystal);

        for (const p of this.players) {
            const startGold = (this.mp.startGold || this.diff.startGold) + (this.talents.startGold || 0);
            this.economy.init(p.id, startGold);
            this.buffs.initPlayer(p.id);
            this.unlockedTowers.set(p.id, new Set([TowerType.ARROW, TowerType.CANNON, TowerType.ICE]));
            if (this.mp.towerLimit !== Infinity) this.towerLimit.set(p.id, this.mp.towerLimit);
        }

        // Controllers
        this.towerCtl = new TowerController({
            entityManager: this.em,
            economy: this.economy,
            map: this.map,
            unlockedTowers: this.unlockedTowers,
            towerLimit: this.towerLimit,
        });
        if (this.talents.unlockTargetMode) {
            for (const p of this.players) this.towerCtl.targetModeUnlocked.add(p.id);
        }
        this.bulletCtl = new BulletController({ entityManager: this.em, rng: this.battleRng });
        this.enemyCtl = new EnemyController({
            entityManager: this.em,
            economy: this.economy,
            crystal: this.crystal,
            rng: this.battleRng,
        });
        this.waveCtl = new WaveController({
            entityManager: this.em,
            rng: this.monsterRng,
            path: this.map.path,
            difficultyMod: this.diff,
            multiplayerMod: this.mp,
            getEnemyWaveBuff: () => this.buffs.consumeEnemyWaveModifier(),
        });
        this.growthSys = new TowerGrowthSystem({ entityManager: this.em, growthMul: this.mp.growthMul });
        this.diceSys = new DiceSystem({
            buffManager: this.buffs,
            rng: this.diceRng,
            reducedPositive: this.diff.dicePoolReduce,
            getOnlineAllies: () => this.players.map((p) => p.id),
            getDiceGoodChance: () => this.diff.diceGoodChance + (this.talents.diceGoodPct || 0),
            getAllyResist: () => this.talents.allyDebuffResist || 0,
        });
        this.gachaSys = new GachaSystem({
            rng: this.gachaRng,
            buffManager: this.buffs,
            economy: this.economy,
            getSrBonus: () => this.talents.gachaSrPct || 0,
        });
        this.pickSys = new TowerPickSystem({
            rng: this.battleRng,
            unlockedTowers: this.unlockedTowers,
            towerController: this.towerCtl,
            economy: this.economy,
        });

        // P1
        this.itemCtl = new ItemController({
            entityManager: this.em,
            economy: this.economy,
            crystal: this.crystal,
            map: this.map,
            towerController: this.towerCtl,
        });
        this.shopCtl = new ShopController({
            rng: this.battleRng,
            economy: this.economy,
            items: this.itemCtl,
            buffManager: this.buffs,
            towerController: this.towerCtl,
            diceSystem: this.diceSys,
        });
        this.randomEvtSys = new RandomEventSystem({
            rng: this.battleRng,
            economy: this.economy,
            entityManager: this.em,
            crystal: this.crystal,
            shopController: this.shopCtl,
            buffManager: this.buffs,
        });
        this.pauseCtl = new PauseController({
            players: this.players.map((p) => p.id),
            hostId: this.players[0].id,
            isBossWave: () => isBossWave(this.currentWave),
            net: cfg.net || null,
        });
        this.popups = new DamagePopupManager();

        // 初始道具
        for (const p of this.players) {
            this.itemCtl.initPlayer(p.id);
            this.itemCtl.add(p.id, ItemType.FREEZE_BOMB, 1);
            this.itemCtl.add(p.id, ItemType.GOLD_RUSH, 1);
        }

        // 事件统计
        this.stats = { kills: 0, leaks: 0, totalGoldEarned: 0 };
        EventBus.on('enemy_killed',    () => { this.stats.kills++; this.waveCtl.onEnemyKilled(); });
        EventBus.on('crystal_damaged', () => { this.stats.leaks++; });
        EventBus.on('economy_change',  ({ delta }: { delta: number }) => { if (delta > 0) this.stats.totalGoldEarned += delta; });

        this.state = State.PREPARE;
    }

    /** 开始战斗 */
    startBattle(): void {
        Logger.info('Battle', 'startBattle seed=', this.seed, 'diff=', this.difficulty, 'players=', this.players.length);
        EventBus.emit('battle_start', this);

        // 三选一模式：监听玩家确认骰子后推进
        EventBus.on('wave_inter_event_done', () => {
            if (this.state === State.WAVE_END) {
                this._advanceFromWaveEnd();
            }
        });

        this._startNextWave();
    }

    private _startNextWave(): void {
        this.currentWave++;
        if (this.currentWave > TOTAL_WAVES) {
            this._finish(true);
            return;
        }
        this.state = State.FIGHTING;
        this.waveCtl.startWave(this.currentWave);
    }

    /** 主循环（由 TimeManager 触发，dtMs = 66） */
    tick(dtMs: number): void {
        if (this.state === State.FINISHED) return;

        this._logicFrameId++;
        EventBus.emit('logic_tick', this._logicFrameId);

        this.itemCtl.tick(dtMs);
        this.enemyCtl.tick(dtMs);

        if (this.crystal.hp <= 0) {
            this._finish(false);
            return;
        }

        if (this.state === State.FIGHTING) {
            this._tickTowers(dtMs);
            this.waveCtl.tick(dtMs);
            if (!this.waveCtl.isWaveActive()) {
                this._onWaveEnd();
            }
        } else if (this.state === State.WAVE_END) {
            const timedOut = this.shopCtl.tick(dtMs);
            if (this.shopCtl.tier !== null && (this.shopCtl.isAllClosed() || timedOut)) {
                this.shopCtl.reset();
                this._advanceFromWaveEnd();
            } else if (this.shopCtl.tier === null) {
                this._advanceFromWaveEnd();
            }
        }
    }

    private _tickTowers(dtMs: number): void {
        const playerMods = new Map<string, GlobalMod>();
        for (const p of this.players) playerMods.set(p.id, this.buffs.getGlobalModifier(p.id));

        for (const tower of this.em.towers.values()) {
            if (tower.dead) continue;
            const mod = playerMods.get(tower.ownerId) || ({} as GlobalMod);

            if (tower.isSummoner()) {
                tower.summonCdMs -= dtMs;
                if (tower.summonCdMs <= 0) {
                    this._summon(tower);
                    const stat = tower.getLevelStat();
                    tower.summonCdMs = (stat.summonInterval || 6) * 1000;
                }
                continue;
            }

            if (tower.isTotem()) continue;

            const aura = this._calcAuraFor(tower);
            const interval = tower.getEffectiveAttackIntervalMs(mod, aura);
            const cur = (this._towerAcc.get(tower.id) || 0) + dtMs;

            if (cur < interval) {
                this._towerAcc.set(tower.id, cur);
                continue;
            }

            const range = tower.getEffectiveRange(mod);
            const enemies = this.em.getEnemiesInRange(tower.x, tower.y, range);
            const lockable = TowerAI.filterLockable(tower, enemies);
            if (lockable.length === 0) {
                this._towerAcc.set(tower.id, Math.min(cur, interval));
                continue;
            }

            const target = TowerAI.pickTarget(tower, lockable)!;
            this.bulletCtl.fire(tower, target, { globalMod: mod, auraMod: aura });
            this._towerAcc.set(tower.id, cur - interval);
        }
    }

    /** 图腾光环加成（最多 3 个叠加） */
    private _calcAuraFor(tower: Tower): AuraMod {
        let count = 0;
        let atkPct = 0;
        let spdPct = 0;
        for (const t of this.em.towers.values()) {
            if (t === tower || !t.isTotem() || t.dead) continue;
            const stat = t.getLevelStat();
            const range = (stat.auraRange || 0) + (t.growth.auraRange || 0);
            const dx = t.x - tower.x;
            const dy = t.y - tower.y;
            if (dx * dx + dy * dy <= range * range) {
                count++;
                atkPct += (stat.auraAtk || 0) + (t.growth.auraAtk || 0);
                spdPct += (stat.auraSpd || 0);
                if (count >= 3) break;
            }
        }
        return { atkPct, spdPct };
    }

    private _summon(tower: Tower): void {
        const stat = tower.getLevelStat();
        const max = (stat.minionMax || 0) + (tower.growth.minionMax || 0);
        const alive = Array.from(this.em.minions.values()).filter((m) => m.towerId === tower.id && !m.dead);
        if (alive.length >= max) return;
        const minion = new Minion({
            ownerId: tower.ownerId,
            towerId: tower.id,
            x: tower.x,
            y: tower.y,
            hp:  (stat.minionHp || 0) + (tower.growth.minionHp || 0),
            atk: (stat.minionAtk || 0) + (tower.growth.minionAtk || 0),
            taunt: tower.level >= 2,
            suicide: tower.level >= 3,
        });
        this.em.addMinion(minion);
    }

    private _onWaveEnd(): void {
        this.state = State.WAVE_END;
        const wave = this.currentWave;

        // 1) 塔成长
        this.growthSys.apply(wave);
        EventBus.emit('growth_applied', { wave });

        // 2) 临时塔位倒计时
        this.itemCtl.onWaveEnd();

        // 3) 波次奖励金币
        const reward = Math.floor(getWaveRewardGold(wave) * (this.diff.waveRewardMul || 1));
        for (const p of this.players) this.economy.addGold(p.id, reward, 'wave_reward');

        // 4) 骰子（先不 emit，等抽卡确认后再 emit）
        const dices: Array<{ player: string; dice: number; picks: unknown[]; allyTargets: unknown }> = [];
        for (const p of this.players) {
            const r = this.diceSys.rollOnce(p.id);
            dices.push({ player: p.id, ...r });
        }

        // 5) 塔三选一（每3波 + 首次建塔后）
        const towerPicks: Array<{ player: string; options: TowerTypeValue[] }> = [];
        if (wave % 3 === 0) {
            for (const p of this.players) {
                const opts = this.pickSys.rollOptions(p.id);
                if (opts.length > 0) {
                    towerPicks.push({ player: p.id, options: opts });
                }
            }
        }

        // 6) 抽卡（每 3 波 + BOSS 波额外）
        const gachas: Array<{ player: string; card: unknown; refundedGold: number }> = [];
        const hasGacha = (wave % 3 === 0 || isBossWave(wave));
        if (hasGacha) {
            for (const p of this.players) {
                const g = this.gachaSys.draw(p.id);
                gachas.push({ player: p.id, ...g });
            }
        }

        // 7) 随机事件
        const evt = this.randomEvtSys.maybeTrigger(wave, this.players.map((p) => p.id));

        // 8) 商店
        const playerIds = this.players.map((p) => p.id);
        const shopOpened = this.shopCtl.openIfTriggered(wave, playerIds);

        // 9) 1 波 buff 到期
        this.buffs.expireOneWave();
        this.economy.resetWaveBuffs();

        EventBus.emit('wave_settle', { wave, dices, gachas, towerPicks, randomEvent: evt, shop: shopOpened });

        // 事件队列交给 UI 层（BattleScene）控制先后顺序
        // 先发 wave_settle，UI 层依次弹出：抽卡(如有) → 骰子 → 推进
        if (!shopOpened) return;
    }

    private _advanceFromWaveEnd(): void {
        if (this.state !== State.WAVE_END) return;
        if (this.currentWave < TOTAL_WAVES) {
            this._startNextWave();
        } else {
            this._finish(this.crystal.hp > 0);
        }
    }

    private _finish(win: boolean): void {
        this.state = State.FINISHED;
        const result: BattleEndResult = {
            win,
            wave: this.currentWave,
            kills: this.stats.kills,
            leaks: this.stats.leaks,
            crystalHp: this.crystal.hp,
            totalGold: this.stats.totalGoldEarned,
            score: this._calcScore(win),
        };
        EventBus.emit('battle_end', result);
        Logger.info('Battle', 'battle_end', result);
    }

    private _calcScore(win: boolean): ScoreResult {
        const survival = (this.currentWave / TOTAL_WAVES) * 100 * 0.5;
        const lifeP   = (this.crystal.hp / Math.max(1, this.crystal.maxHp)) * 100 * 0.2;
        const killEff = this.stats.kills > 0 ? Math.min(100, 100) * 0.15 : 0;
        const econ    = this.stats.totalGoldEarned > 0 ? Math.min(100, 60) * 0.10 : 0;
        const bonus   = win ? 5 : 0;
        const score = Math.round(survival + lifeP + killEff + econ + bonus);
        let grade = 'D';
        if (score >= 95) grade = 'S';
        else if (score >= 85) grade = 'A';
        else if (score >= 70) grade = 'B';
        else if (score >= 50) grade = 'C';
        return { score, grade };
    }

    // ===== 玩家操作 =====
    build(playerId: string, type: TowerTypeValue, x: number, y: number)        { return this.towerCtl.build(playerId, type, x, y); }
    upgrade(playerId: string, towerId: string)                                 { return this.towerCtl.upgrade(playerId, towerId); }
    sell(playerId: string, towerId: string)                                    { return this.towerCtl.sell(playerId, towerId); }
    switchMode(playerId: string, towerId: string, m: TargetModeValue)          { return this.towerCtl.switchTargetMode(playerId, towerId, m); }
    useItem(playerId: string, itemId: string)                                  { return this.itemCtl.use(playerId, itemId); }
    shopBuy(playerId: string, slot: number, extra?: { towerId?: string })      { return this.shopCtl.buy(playerId, slot, extra); }
    shopRefresh(playerId: string)                                              { return this.shopCtl.refresh(playerId); }
    shopClose(playerId: string)                                                { return this.shopCtl.close(playerId); }
    pause(playerId: string) {
        if (this.players[0].id === playerId) return this.pauseCtl.hostPause();
        return this.pauseCtl.requestVote(playerId);
    }
    resume()                                          { return this.pauseCtl.resume(); }
    pauseVote(playerId: string, agree: boolean)       { return this.pauseCtl.vote_(playerId, agree); }
}

// 兼容旧 require 风格：BattleManager.State
(BattleManager as any).State = State;
