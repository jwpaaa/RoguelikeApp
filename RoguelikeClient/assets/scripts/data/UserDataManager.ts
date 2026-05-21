/**
 * 用户档案（金币/钻石/等级/经验/最高战绩）
 */

import { Storage } from '../utils/Storage';
import { getLevelByExp, getTalentPointsByLevel } from '../config/TalentConfig';

const KEY = 'rtd_user';

export interface UserSettings {
    sfx?: number;
    bgm?: number;
    master?: number;
    muted?: boolean;
    fastMode?: boolean;
    skipAnimation?: boolean;
    [key: string]: number | boolean | undefined;
}

export interface UserData {
    openid: string;
    nickname: string;
    avatar: string;
    gold: number;
    diamond: number;
    exp: number;
    bestWave: number;
    bestScore: number;
    bestGrade: string;
    totalBattles: number;
    totalWins: number;
    talents: Record<string, number>;
    settings: UserSettings;
    createdAt: number;
    updatedAt: number;
    completedNormal?: number;
    completedMP?: number;
    realNameVerified?: boolean;
}

const DEFAULT: UserData = Object.freeze({
    openid: '',
    nickname: '玩家',
    avatar: '',
    gold: 0,
    diamond: 0,
    exp: 0,
    bestWave: 0,
    bestScore: 0,
    bestGrade: 'D',
    totalBattles: 0,
    totalWins: 0,
    talents: {},
    settings: { sfx: 1, bgm: 1, fastMode: false, skipAnimation: false },
    createdAt: 0,
    updatedAt: 0,
}) as UserData;

export class UserDataManager {
    public data: UserData;

    constructor() {
        const raw = Storage.get(KEY) as Partial<UserData> | null;
        this.data = raw
            ? { ...DEFAULT, ...raw, settings: { ...DEFAULT.settings, ...(raw.settings || {}) } }
            : { ...DEFAULT, createdAt: Date.now() };
    }

    get level(): number { return getLevelByExp(this.data.exp); }

    get talentPoints(): number {
        const totalGained = getTalentPointsByLevel(this.level);
        let used = 0;
        for (const lv of Object.values(this.data.talents || {})) used += lv;
        return Math.max(0, totalGained - used);
    }

    save(): void {
        this.data.updatedAt = Date.now();
        Storage.set(KEY, this.data);
    }

    setProfile({ openid, nickname, avatar }: { openid?: string; nickname?: string; avatar?: string }): void {
        if (openid)   this.data.openid = openid;
        if (nickname) this.data.nickname = nickname;
        if (avatar)   this.data.avatar = avatar;
        this.save();
    }

    addExp(exp: number):     void { this.data.exp += exp; this.save(); }
    addGold(g: number):      void { this.data.gold = Math.max(0, this.data.gold + g); this.save(); }
    addDiamond(d: number):   void { this.data.diamond = Math.max(0, this.data.diamond + d); this.save(); }

    onBattleEnd({ wave, score, grade, win }: { wave: number; score: number; grade: string; win: boolean }): void {
        this.data.totalBattles++;
        if (win) this.data.totalWins++;
        if (wave > (this.data.bestWave || 0)) this.data.bestWave = wave;
        if (score > (this.data.bestScore || 0)) {
            this.data.bestScore = score;
            this.data.bestGrade = grade;
        }
        this.save();
    }

    upgradeTalent(talentId: string, costPerLevel: number[]): boolean {
        const cur = this.data.talents[talentId] || 0;
        const nextLv = cur + 1;
        if (nextLv > costPerLevel.length) return false;
        const cost = costPerLevel[nextLv - 1];
        if (this.talentPoints < cost) return false;
        this.data.talents[talentId] = nextLv;
        this.save();
        return true;
    }

    resetTalents(): void {
        this.data.talents = {};
        this.save();
    }

    setSetting(key: string, value: number | boolean): void {
        this.data.settings = this.data.settings || {};
        this.data.settings[key] = value;
        this.save();
    }
}

export const instance = new UserDataManager();
