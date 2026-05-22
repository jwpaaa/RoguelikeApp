/**
 * UI 常量（基准分辨率 1280×720 横屏）
 */

export const DesignResolution = Object.freeze({
    WIDTH: 1280,
    HEIGHT: 720,
});

export const MapView = Object.freeze({
    LEFT:   20,
    BOTTOM: 100,
    WIDTH:  1000,
    HEIGHT: 500,
    CELL_PX_X: 50,
    CELL_PX_Y: 33,
});

function _hex(v: number, digits: number): string {
    let s = v.toString(16).toUpperCase();
    while (s.length < digits) s = '0' + s;
    return s;
}

export const Palette = Object.freeze({
    WHITE:        _hex(0xFFFFFFFF, 8),
    BLACK:        _hex(0x000000FF, 8),
    GOLD:         _hex(0xFFD700FF, 8),
    SILVER:       _hex(0xC0C0C0FF, 8),
    RED:          _hex(0xE74C3CFF, 8),
    GREEN:        _hex(0x2ECC71FF, 8),
    BLUE:         _hex(0x3498DBFF, 8),
    PURPLE:       _hex(0x9B59B6FF, 8),
    DARK_BG:      _hex(0x1E1E2EFF, 8),
    PANEL_BG:     _hex(0x2C2C3EE0, 8),
    BTN_NORMAL:   _hex(0x4A90E2FF, 8),
    BTN_PRESSED:  _hex(0x357AC9FF, 8),
    BTN_DISABLED: _hex(0x95A5A6FF, 8),
    HP_BAR_BG:    _hex(0x444444FF, 8),
    HP_BAR_FG:    _hex(0xE74C3CFF, 8),
    XP_BAR_FG:    _hex(0x2ECC71FF, 8),
    SHIELD:       _hex(0x5DADE2FF, 8),
    DMG_NORMAL:   _hex(0xFFFFFFFF, 8),
    DMG_CRIT:     _hex(0xFFD700FF, 8),
    DMG_DOT:      _hex(0x9B59B6FF, 8),
    DMG_HEAL:     _hex(0x2ECC71FF, 8),
    DMG_IMMUNE:   _hex(0x95A5A6FF, 8),
    DMG_SHIELD:   _hex(0x5DADE2FF, 8),
});

export const FontSize = Object.freeze({
    TINY:    14,
    SMALL:   18,
    NORMAL:  22,
    LARGE:   28,
    HUGE:    36,
    TITLE:   48,
});

export const ZOrder = Object.freeze({
    GAME:    0,
    HUD:     100,
    POPUP:   200,
    TOAST:   300,
    LOADING: 400,
    DEBUG:   999,
});
