// src/constants/glassAccentTints.js
//
// Single source of truth for the Glassmorphism & Visual Customization
// "Accent / Tint" palette - shared between SettingsPage.jsx (the picker
// UI itself) and DashboardLayout.jsx (real app-startup application of
// the user's saved choice), so both places genuinely, always agree on
// the exact same set of ids/colors rather than risk drifting apart if
// this list is ever edited again.
//
// 'default' intentionally has no rgb - both consumers read that as "no
// override", correctly falling back to the active theme's own
// --primary/--accent values.
export const GLASS_ACCENT_TINTS = [
    { id: 'default', label: 'Default', swatch: 'var(--primary)', rgb: null },
    { id: 'sky', label: 'Sky', swatch: '#38BDF8', rgb: '56, 189, 248' },
    { id: 'cyan', label: 'Cyan', swatch: '#22D3EE', rgb: '34, 211, 238' },
    { id: 'teal', label: 'Teal', swatch: '#2DD4BF', rgb: '45, 212, 191' },
    { id: 'turquoise', label: 'Turquoise', swatch: '#14B8A6', rgb: '20, 184, 166' },
    { id: 'emerald', label: 'Emerald', swatch: '#34D399', rgb: '52, 211, 153' },
    { id: 'mint', label: 'Mint', swatch: '#6EE7B7', rgb: '110, 231, 183' },
    { id: 'lime', label: 'Lime', swatch: '#A3E635', rgb: '163, 230, 53' },
    { id: 'gold', label: 'Gold', swatch: '#EAB308', rgb: '234, 179, 8' },
    { id: 'amber', label: 'Amber', swatch: '#FBBF24', rgb: '251, 191, 36' },
    { id: 'yellow', label: 'Yellow', swatch: '#FDE047', rgb: '253, 224, 71' },
    { id: 'orange', label: 'Orange', swatch: '#FB923C', rgb: '251, 146, 60' },
    { id: 'coral', label: 'Coral', swatch: '#FF6B6B', rgb: '255, 107, 107' },
    { id: 'salmon', label: 'Salmon', swatch: '#FCA5A5', rgb: '252, 165, 165' },
    { id: 'red', label: 'Red', swatch: '#EF4444', rgb: '239, 68, 68' },
    { id: 'crimson', label: 'Crimson', swatch: '#DC2626', rgb: '220, 38, 38' },
    { id: 'rose', label: 'Rose', swatch: '#FB7185', rgb: '251, 113, 133' },
    { id: 'pink', label: 'Pink', swatch: '#F472B6', rgb: '244, 114, 182' },
    { id: 'magenta', label: 'Magenta', swatch: '#F0ABFC', rgb: '240, 171, 252' },
    { id: 'fuchsia', label: 'Fuchsia', swatch: '#E879F9', rgb: '232, 121, 249' },
    { id: 'violet', label: 'Violet', swatch: '#A78BFA', rgb: '167, 139, 250' },
    { id: 'lavender', label: 'Lavender', swatch: '#C4B5FD', rgb: '196, 181, 253' },
    { id: 'indigo', label: 'Indigo', swatch: '#818CF8', rgb: '129, 140, 248' },
    { id: 'blue', label: 'Blue', swatch: '#60A5FA', rgb: '96, 165, 250' },
    { id: 'slate', label: 'Slate', swatch: '#94A3B8', rgb: '148, 163, 184' },
];
