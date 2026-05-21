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

export const Palette = Object.freeze({
    WHITE:        0xFFFFFFFF,
    BLACK:        0x000000FF,
    GOLD:         0xFFD700FF,
    SILVER:       0xC0C0C0FF,
    RED:          0xE74C3CFF,
    GREEN:        0x2ECC71FF,
    BLUE:         0x3498DBFF,
    PURPLE:       0x9B59B6FF,
    DARK_BG:      0x1E1E2EFF,
    PANEL_BG:     0x2C2C3EE0,
    BTN_NORMAL:   0x4A90E2FF,
    BTN_PRESSED:  0x357AC9FF,
    BTN_DISABLED: 0x95A5A6FF,
    HP_BAR_BG:    0x444444FF,
    HP_BAR_FG:    0xE74C3CFF,
    XP_BAR_FG:    0x2ECC71FF,
    SHIELD:       0x5DADE2FF,
    DMG_NORMAL:   0xFFFFFFFF,
    DMG_CRIT:     0xFFD700FF,
    DMG_DOT:      0x9B59B6FF,
    DMG_HEAL:     0x2ECC71FF,
    DMG_IMMUNE:   0x95A5A6FF,
    DMG_SHIELD:   0x5DADE2FF,
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
