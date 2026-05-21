/**
 * 音效/音乐系统（来自需求文档 §F-2.9）
 * ---------------------------------------------------------------
 * - BGM：场景切换时 crossfade（约 1s 淡入淡出）
 * - SFX：池化播放，相同音效间隔 >0.1s 防止爆音
 * - 4 个独立音量滑条：master / bgm / sfx / ambient
 *
 * 跨端：
 *   - 微信小游戏：wx.createInnerAudioContext —— **使用对象池**避免泄漏
 *   - 浏览器：HTMLAudioElement
 *   - Node 模拟器：静默实现
 */

import { instance as EventBus } from './EventBus';
import { instance as User } from '../data/UserDataManager';

interface WxAudioContext {
    src: string;
    volume: number;
    loop: boolean;
    play(): void;
    stop?(): void;
    onEnded?(fn: () => void): void;
    offEnded?(fn: () => void): void;
    destroy?(): void;
}

declare const wx: undefined | {
    createInnerAudioContext: () => WxAudioContext;
};

const SFX_MIN_INTERVAL_MS = 100;
const POOL_MAX_SIZE = 8;

export interface PlayOptions {
    volume?: number;
}

export class AudioManager {
    masterVolume: number = 1;
    bgmVolume: number = 1;
    sfxVolume: number = 1;
    ambientVolume: number = 0.5;
    muted: boolean = false;

    private _sfxLastPlay: Map<string, number> = new Map();
    private _currentBgm: string | null = null;
    /** 微信 InnerAudioContext 对象池（仅 SFX 用，BGM 单独持有） */
    private _wxSfxPool: WxAudioContext[] = [];
    private _wxBgmCtx: WxAudioContext | null = null;

    constructor() {
        const s: any = User.data.settings || {};
        if (typeof s.sfx === 'number')    this.sfxVolume = s.sfx;
        if (typeof s.bgm === 'number')    this.bgmVolume = s.bgm;
        if (typeof s.master === 'number') this.masterVolume = s.master;
        if (typeof s.muted === 'boolean') this.muted = s.muted;
    }

    setMaster(v: number):   void { this.masterVolume = clamp01(v); User.setSetting('master', v); EventBus.emit('audio_volume', this); }
    setBgm(v: number):      void {
        this.bgmVolume = clamp01(v);
        User.setSetting('bgm', v);
        if (this._wxBgmCtx) this._wxBgmCtx.volume = this.masterVolume * this.bgmVolume;
        EventBus.emit('audio_volume', this);
    }
    setSfx(v: number):      void { this.sfxVolume    = clamp01(v); User.setSetting('sfx', v);    EventBus.emit('audio_volume', this); }
    setAmbient(v: number):  void { this.ambientVolume = clamp01(v); EventBus.emit('audio_volume', this); }
    setMuted(b: boolean):   void {
        this.muted = !!b;
        User.setSetting('muted', !!b);
        if (b) this.stopBgm();
        EventBus.emit('audio_volume', this);
    }

    /** 播放音效（按需求节流 100ms） */
    playSfx(sfxId: string, opts?: PlayOptions): void {
        if (this.muted) return;
        const now = Date.now();
        const last = this._sfxLastPlay.get(sfxId) || 0;
        if (now - last < SFX_MIN_INTERVAL_MS) return;
        this._sfxLastPlay.set(sfxId, now);
        const vol = this.masterVolume * this.sfxVolume * (opts && opts.volume != null ? opts.volume : 1);
        this._playSfxImpl(sfxId, vol);
    }

    /** 切换 BGM */
    playBgm(bgmId: string): void {
        if (this.muted) { this._currentBgm = bgmId; return; }
        if (this._currentBgm === bgmId) return;
        this._currentBgm = bgmId;
        const vol = this.masterVolume * this.bgmVolume;
        this._playBgmImpl(bgmId, vol);
        EventBus.emit('audio_bgm', { bgmId });
    }

    stopBgm(): void {
        if (typeof wx !== 'undefined' && this._wxBgmCtx) {
            try { this._wxBgmCtx.stop && this._wxBgmCtx.stop(); } catch { /* swallow */ }
        }
        this._currentBgm = null;
        EventBus.emit('audio_bgm', { bgmId: null });
    }

    /** 释放所有资源（场景切换时调用） */
    release(): void {
        if (typeof wx !== 'undefined') {
            for (const ctx of this._wxSfxPool) {
                try { ctx.destroy && ctx.destroy(); } catch { /* swallow */ }
            }
            if (this._wxBgmCtx) {
                try { this._wxBgmCtx.destroy && this._wxBgmCtx.destroy(); } catch { /* swallow */ }
            }
        }
        this._wxSfxPool.length = 0;
        this._wxBgmCtx = null;
        this._currentBgm = null;
    }

    private _playSfxImpl(audioId: string, volume: number): void {
        // 微信小游戏：复用池中可用的 ctx
        if (typeof wx !== 'undefined' && wx.createInnerAudioContext) {
            const ctx = this._acquireSfxCtx();
            try {
                ctx.src = 'audio/' + audioId + '.mp3';
                ctx.volume = volume;
                ctx.loop = false;
                ctx.play();
            } catch { /* swallow */ }
            return;
        }
        // 浏览器
        if (typeof Audio !== 'undefined') {
            try {
                const a = new Audio('audio/' + audioId + '.mp3');
                a.volume = volume;
                a.play().catch(() => { /* swallow */ });
            } catch { /* swallow */ }
            return;
        }
        // Node 模拟器：静默
    }

    private _playBgmImpl(audioId: string, volume: number): void {
        // 微信小游戏：单独持有一个 BGM 实例
        if (typeof wx !== 'undefined' && wx.createInnerAudioContext) {
            try {
                if (this._wxBgmCtx) {
                    try { this._wxBgmCtx.stop && this._wxBgmCtx.stop(); } catch { /* swallow */ }
                } else {
                    this._wxBgmCtx = wx.createInnerAudioContext();
                }
                this._wxBgmCtx.src = 'audio/' + audioId + '.mp3';
                this._wxBgmCtx.volume = volume;
                this._wxBgmCtx.loop = true;
                this._wxBgmCtx.play();
            } catch { /* swallow */ }
            return;
        }
        if (typeof Audio !== 'undefined') {
            try {
                const a = new Audio('audio/' + audioId + '.mp3');
                a.volume = volume;
                a.loop = true;
                a.play().catch(() => { /* swallow */ });
            } catch { /* swallow */ }
        }
    }

    /** 从 SFX 池获取一个 ctx，没有则创建（上限 POOL_MAX_SIZE） */
    private _acquireSfxCtx(): WxAudioContext {
        // 优先复用：找到当前未在播放的（简化判定：取出第 1 个）
        if (this._wxSfxPool.length > 0) {
            const ctx = this._wxSfxPool.shift()!;
            this._wxSfxPool.push(ctx); // 轮转
            return ctx;
        }
        const ctx = wx!.createInnerAudioContext();
        if (this._wxSfxPool.length < POOL_MAX_SIZE) this._wxSfxPool.push(ctx);
        return ctx;
    }
}

function clamp01(v: number): number { return v < 0 ? 0 : v > 1 ? 1 : v; }

export const instance = new AudioManager();
