// src/constants/wallpaperOptions.js
//
// Single source of truth for the Custom Background / Wallpaper Selector.
// Shared between SettingsPage.jsx (the picker UI) and
// AlternateBackgrounds.jsx (the actual render lookup), so the two can
// never drift out of sync with each other - the exact class of "clicking
// theme X doesn't reliably show theme X" bug that happens when a picker's
// ids and a renderer's ids are two separate, hand-maintained lists.
//
// 'sky' is the one special id - it means "no override", falling back to
// the real, existing Animated Sky (DynamicBackground.jsx), which only
// ever renders when Dynamic theme is genuinely active. Every other id
// here corresponds 1:1 to a real component in AlternateBackgrounds.jsx -
// either one of the 23 original hand-written ones below, or one of the
// 130+ expansion themes in wallpaperThemeConfigs.js (rendered generically
// by ParametricWallpaper.jsx), merged in at the bottom of this file.
import { PARAMETRIC_THEME_CONFIGS } from './wallpaperThemeConfigs.js';

const CLASSIC_WALLPAPER_OPTIONS = [
    { id: 'sky', label: 'Animated Sky', category: 'Classic', preview: 'linear-gradient(135deg, #1e293b, #38bdf8)' },
    { id: 'cyberpunk', label: 'Cyberpunk Neon', category: 'Classic', preview: 'linear-gradient(135deg, #0D0221, #FF00C8, #00EAFF)' },
    { id: 'deepspace', label: 'Deep Space', category: 'Classic', preview: 'radial-gradient(circle, #0B1026, #030308)' },
    { id: 'aurora', label: 'Minimalist Aurora', category: 'Classic', preview: 'linear-gradient(135deg, #0F1115, #A78BFA, #34D399)' },
    { id: 'matrix', label: 'Matrix Grid', category: 'Classic', preview: 'linear-gradient(180deg, #020402, #22D35E)' },
    { id: 'quantumvoid', label: 'Quantum Void', category: 'Classic', preview: 'radial-gradient(circle, #1A0B2E, #06010F)' },
    { id: 'solarflare', label: 'Solar Flare', category: 'Classic', preview: 'linear-gradient(135deg, #2B0A00, #FF6B00, #FFD500)' },
    { id: 'obsidianglass', label: 'Obsidian Glass', category: 'Classic', preview: 'linear-gradient(135deg, #0A0A0C, #1C1C22, #2E2E38)' },
    { id: 'neonsunset', label: 'Neon Sunset', category: 'Classic', preview: 'linear-gradient(135deg, #1A0429, #FF2E92, #FF7A00)' },
    { id: 'electricindigo', label: 'Electric Indigo', category: 'Classic', preview: 'linear-gradient(135deg, #05010F, #4C1D95, #6D28D9)' },
    { id: 'cybermatrix', label: 'Cyber Matrix', category: 'Classic', preview: 'linear-gradient(135deg, #001414, #0D3B3B, #14B8A6)' },
    { id: 'supernovared', label: 'Supernova Red', category: 'Classic', preview: 'radial-gradient(circle, #3D0000, #B91C1C, #FCA5A5)' },
    { id: 'eclipseshadow', label: 'Eclipse Shadow', category: 'Classic', preview: 'radial-gradient(circle, #F59E0B, #1C1917, #000000)' },
    { id: 'astralpurple', label: 'Astral Purple', category: 'Classic', preview: 'radial-gradient(circle, #2E1065, #0B0118)' },
    { id: 'cybergrid', label: 'Cyber Grid', category: 'Classic', preview: 'linear-gradient(135deg, #001220, #0EA5E9, #E0F2FE)' },
    { id: 'neongenesis', label: 'Neon Genesis', category: 'Classic', preview: 'linear-gradient(135deg, #052E16, #7E22CE, #EC4899)' },
    { id: 'voidblue', label: 'Void Blue', category: 'Classic', preview: 'radial-gradient(circle, #0A1128, #020617)' },
    { id: 'crimsonflux', label: 'Crimson Flux', category: 'Classic', preview: 'linear-gradient(135deg, #1A0000, #7F1D1D, #DC2626)' },
    { id: 'emeraldmatrix', label: 'Emerald Matrix', category: 'Classic', preview: 'linear-gradient(135deg, #001A12, #065F46, #10B981)' },
    { id: 'solarhorizon', label: 'Solar Horizon', category: 'Classic', preview: 'linear-gradient(0deg, #7C2D12, #F97316, #FEF3C7)' },
    { id: 'frostamber', label: 'Frost Amber', category: 'Classic', preview: 'linear-gradient(135deg, #0C1E2E, #38BDF8, #FBBF24)' },
    { id: 'stellarnebula', label: 'Stellar Nebula', category: 'Classic', preview: 'radial-gradient(circle, #1E1B4B, #BE185D, #F472B6)' },
    { id: 'abyssaldark', label: 'Abyssal Dark', category: 'Classic', preview: 'linear-gradient(180deg, #000205, #061018)' },
    { id: 'prismglass', label: 'Prism Glass', category: 'Classic', preview: 'linear-gradient(135deg, #F472B6, #38BDF8, #A3E635, #FBBF24)' },
];

// Every expansion theme's preview is derived directly from the exact same
// `base` gradient ParametricWallpaper.jsx renders with - not a separately
// hand-typed color, so the picker swatch can never drift out of sync with
// what actually shows once selected.
const EXPANSION_WALLPAPER_OPTIONS = PARAMETRIC_THEME_CONFIGS.map((cfg) => ({
    id: cfg.id,
    label: cfg.label,
    category: cfg.category,
    preview: `linear-gradient(${cfg.base.a}deg, ${cfg.base.s.join(', ')})`,
}));

export const WALLPAPER_OPTIONS = [...CLASSIC_WALLPAPER_OPTIONS, ...EXPANSION_WALLPAPER_OPTIONS];

// Ordered category list for the picker's filter chips - 'All' plus every
// category in first-appearance order (Classic first, then each expansion
// category in the order they're defined above).
export const WALLPAPER_CATEGORIES = ['All', ...Array.from(new Set(WALLPAPER_OPTIONS.map((wp) => wp.category)))];
