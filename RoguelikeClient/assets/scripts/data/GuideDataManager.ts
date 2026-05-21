/**
 * 引导步骤记录
 */

import { Storage } from '../utils/Storage';

const KEY = 'rtd_guide';

interface GuideData {
    stage: number;
    shownTips: string[];
    skipped: boolean;
}

export class GuideDataManager {
    public data: GuideData;

    constructor() {
        const raw = Storage.get(KEY) as Partial<GuideData> | null;
        this.data = {
            stage: raw?.stage ?? 0,
            shownTips: raw?.shownTips ?? [],
            skipped: raw?.skipped ?? false,
        };
    }

    isStageDone(stage: number): boolean { return this.data.stage >= stage; }
    setStage(stage: number):    void    { this.data.stage = Math.max(this.data.stage, stage); this._save(); }
    isTipShown(tipId: string):  boolean { return (this.data.shownTips || []).indexOf(tipId) >= 0; }
    markTipShown(tipId: string): void {
        this.data.shownTips = this.data.shownTips || [];
        if (this.data.shownTips.indexOf(tipId) < 0) {
            this.data.shownTips.push(tipId);
            this._save();
        }
    }
    setSkipped(): void { this.data.skipped = true; this.data.stage = 99; this._save(); }
    isSkipped():  boolean { return !!this.data.skipped; }

    private _save(): void { Storage.set(KEY, this.data); }
}

export const instance = new GuideDataManager();
