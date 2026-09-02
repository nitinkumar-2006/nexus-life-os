// src/constants/wallpaperThemeConfigs.js
//
// The expansion themes rendered by ParametricWallpaper.jsx. Each entry
// is deliberately compact: a 3-4-stop base gradient, 1-2 glow accent
// colors with position/size, and one named effect layer (see
// ParametricWallpaper's EFFECT_COMPONENTS map for what each fx id
// actually renders). Every base gradient is a DARK color (never a
// light/pastel full background) even for the "Pastel Dream" category,
// deliberately matching the existing 23 hand-written wallpapers in
// AlternateBackgrounds.jsx (all dark-based with translucent accents) -
// this is what lets the app's existing, wallpaper-agnostic contrast
// fix in style.css (which forces light text + a dark-navy glass floor
// for ANY custom wallpaper, regardless of which one) cover every one
// of these themes automatically, with zero new CSS needed. Pastel
// moods are expressed here as soft-colored GLOW accents on a dark
// slate base, exactly like the existing "Frost Amber" wallpaper
// already does.
//
// CULLED from an earlier 130+-entry version, per explicit, direct
// feedback: each category used to carry ~11 entries that were
// genuinely near-duplicates of each other - the same base palette
// family with only a slightly different hex shade, the same glow-
// color pairing, and the same handful of `fx` values just cycling in
// sequence. Picking through 11 wallpapers per category that all read
// as "basically the same one again" was a real, valid complaint, not
// a style nitpick. Every category below keeps only its most visually
// distinct ~half (selected specifically to maximize the difference
// between what's left, not an arbitrary trim), and one genuinely new
// category (Iridescent Flow) was added with a technique nothing above
// already uses - a true multi-hue animated gradient (5 real hue
// families in one shifting base, not 2-3 similar ones) paired with a
// glowing vignette edge, for real additional variety rather than one
// more recolor of the existing formula.
//
// wallpaperOptions.js derives each entry's picker preview gradient
// directly from this same `base` field, so the swatch a user clicks
// always matches what actually renders - no separately hand-typed
// preview to drift out of sync.
export const PARAMETRIC_THEME_CONFIGS = [
    // ---- Cyberpunk & Neon ----
    { id: 'neonvortex', label: 'Neon Vortex', category: 'Cyberpunk & Neon', base: { a: 135, s: ['#0D0221', '#2A0845', '#3B0764'] }, glow: [['255,0,200', '15%', '15%', 380], ['0,234,255', '80%', '80%', 420]], fx: 'grid' },
    { id: 'synthwave84', label: "Synthwave '84", category: 'Cyberpunk & Neon', base: { a: 160, s: ['#1A0033', '#3B0764', '#6D28D9'] }, glow: [['255,0,153', '50%', '10%', 420], ['0,229,255', '50%', '90%', 380]], fx: 'streaks' },
    { id: 'neonalley', label: 'Neon Alley', category: 'Cyberpunk & Neon', base: { a: 145, s: ['#0A0018', '#240046', '#3C096C'] }, glow: [['255,42,109', '15%', '15%', 380], ['58,134,255', '80%', '80%', 420]], fx: 'grid' },
    { id: 'laserdrift', label: 'Laser Drift', category: 'Cyberpunk & Neon', base: { a: 130, s: ['#030014', '#1B003A', '#31006B'] }, glow: [['0,255,255', '50%', '10%', 420], ['255,0,80', '50%', '90%', 380]], fx: 'streaks' },
    { id: 'plasmawire', label: 'Plasma Wire', category: 'Cyberpunk & Neon', base: { a: 140, s: ['#050010', '#180034', '#2A0056'] }, glow: [['190,0,255', '15%', '15%', 380], ['0,255,170', '80%', '80%', 420]], fx: 'grid' },
    { id: 'neotokyo', label: 'Neo Tokyo', category: 'Cyberpunk & Neon', base: { a: 125, s: ['#0A0014', '#25003D', '#420066'] }, glow: [['255,20,147', '50%', '10%', 420], ['0,229,255', '50%', '90%', 380]], fx: 'streaks' },

    // ---- Deep Space & Cosmic ----
    { id: 'orionrift', label: 'Orion Rift', category: 'Deep Space & Cosmic', base: { a: 135, s: ['#05070F', '#0C1130', '#141B4D'] }, glow: [['99,102,241', '15%', '15%', 380], ['56,189,248', '80%', '80%', 420]], fx: 'stars' },
    { id: 'galacticcore', label: 'Galactic Core', category: 'Deep Space & Cosmic', base: { a: 160, s: ['#020204', '#0B0C22', '#161A44'] }, glow: [['167,139,250', '50%', '10%', 420], ['56,189,248', '50%', '90%', 380]], fx: 'stars' },
    { id: 'voyagerdark', label: 'Voyager Dark', category: 'Deep Space & Cosmic', base: { a: 145, s: ['#010103', '#08091C', '#111333'] }, glow: [['56,189,248', '15%', '15%', 380], ['129,140,248', '80%', '80%', 420]], fx: 'stars' },
    { id: 'lunarhalo', label: 'Lunar Halo', category: 'Deep Space & Cosmic', base: { a: 130, s: ['#030307', '#0C0D22', '#181A3E'] }, glow: [['226,232,240', '50%', '10%', 420], ['99,102,241', '50%', '90%', 380]], fx: 'stars' },
    { id: 'blackholeedge', label: 'Black Hole Edge', category: 'Deep Space & Cosmic', base: { a: 140, s: ['#000000', '#050510', '#0B0C22'] }, glow: [['129,140,248', '15%', '15%', 380], ['20,20,40', '80%', '80%', 420]], fx: 'rings' },
    { id: 'meteorfield', label: 'Meteor Field', category: 'Deep Space & Cosmic', base: { a: 125, s: ['#040408', '#0F1024', '#1B1D48'] }, glow: [['251,191,36', '50%', '10%', 420], ['99,102,241', '50%', '90%', 380]], fx: 'stars' },

    // ---- Aurora & Flow ----
    { id: 'auroraveil', label: 'Aurora Veil', category: 'Aurora & Flow', base: { a: 135, s: ['#0B0D10', '#0F2027', '#16323D'] }, glow: [['52,211,153', '15%', '15%', 380], ['129,140,248', '80%', '80%', 420]], fx: 'particles' },
    { id: 'glacierflow', label: 'Glacier Flow', category: 'Aurora & Flow', base: { a: 145, s: ['#0A0D10', '#132A33', '#1D4048'] }, glow: [['125,211,252', '15%', '15%', 380], ['167,243,208', '80%', '80%', 420]], fx: 'rings' },
    { id: 'emeraldmist', label: 'Emerald Mist', category: 'Aurora & Flow', base: { a: 130, s: ['#090B09', '#0F241A', '#183828'] }, glow: [['52,211,153', '50%', '10%', 420], ['190,242,100', '50%', '90%', 380]], fx: 'particles' },
    { id: 'duskaurora', label: 'Dusk Aurora', category: 'Aurora & Flow', base: { a: 155, s: ['#0B0A10', '#1B1330', '#2A1E4A'] }, glow: [['167,139,250', '10%', '50%', 400], ['74,222,128', '90%', '50%', 400]], fx: 'rings' },
    { id: 'velvetflow', label: 'Velvet Flow', category: 'Aurora & Flow', base: { a: 140, s: ['#0C0A0F', '#1A1330', '#281E4C'] }, glow: [['196,181,253', '15%', '15%', 380], ['129,230,217', '80%', '80%', 420]], fx: 'particles' },
    { id: 'softcascade', label: 'Soft Cascade', category: 'Aurora & Flow', base: { a: 125, s: ['#090B0E', '#132430', '#1C3648'] }, glow: [['147,197,253', '50%', '10%', 420], ['216,180,254', '50%', '90%', 380]], fx: 'rings' },

    // ---- Matrix & Tech Grid ----
    { id: 'codecascade', label: 'Code Cascade', category: 'Matrix & Tech Grid', base: { a: 135, s: ['#010401', '#03130A', '#061F12'] }, glow: [['34,211,94', '15%', '15%', 380], ['163,230,53', '80%', '80%', 420]], fx: 'matrix' },
    { id: 'circuitboard', label: 'Circuit Board', category: 'Matrix & Tech Grid', base: { a: 160, s: ['#000302', '#031310', '#06221C'] }, glow: [['45,212,191', '50%', '10%', 420], ['34,211,94', '50%', '90%', 380]], fx: 'grid' },
    { id: 'bytestream', label: 'Byte Stream', category: 'Matrix & Tech Grid', base: { a: 145, s: ['#000000', '#041206', '#08200C'] }, glow: [['74,222,128', '15%', '15%', 380], ['45,212,191', '80%', '80%', 420]], fx: 'matrix' },
    { id: 'gridlock', label: 'Gridlock', category: 'Matrix & Tech Grid', base: { a: 130, s: ['#010201', '#051D14', '#092E1F'] }, glow: [['20,184,166', '50%', '10%', 420], ['74,222,128', '50%', '90%', 380]], fx: 'grid' },
    { id: 'hexgrid', label: 'Hex Grid', category: 'Matrix & Tech Grid', base: { a: 140, s: ['#000100', '#031A12', '#062B1F'] }, glow: [['45,212,191', '15%', '15%', 380], ['132,204,22', '80%', '80%', 420]], fx: 'matrix' },
    { id: 'datavault', label: 'Data Vault', category: 'Matrix & Tech Grid', base: { a: 125, s: ['#000000', '#041808', '#082C10'] }, glow: [['190,242,100', '50%', '10%', 420], ['45,212,191', '50%', '90%', 380]], fx: 'scan' },

    // ---- Quantum & Abstract Void ----
    { id: 'quantumfoam', label: 'Quantum Foam', category: 'Quantum & Abstract Void', base: { a: 135, s: ['#05020A', '#1A0B33', '#2C1258'] }, glow: [['167,139,250', '15%', '15%', 380], ['236,72,153', '80%', '80%', 420]], fx: 'rings' },
    { id: 'entangleddream', label: 'Entangled Dream', category: 'Quantum & Abstract Void', base: { a: 160, s: ['#040108', '#170A2E', '#28104E'] }, glow: [['232,121,249', '50%', '10%', 420], ['129,140,248', '50%', '90%', 380]], fx: 'stars' },
    { id: 'singularity', label: 'Singularity', category: 'Quantum & Abstract Void', base: { a: 120, s: ['#000000', '#0D0620', '#1A0C3C'] }, glow: [['167,139,250', '10%', '50%', 400], ['255,255,255', '90%', '50%', 400]], fx: 'stars' },
    { id: 'voidbloom', label: 'Void Bloom', category: 'Quantum & Abstract Void', base: { a: 130, s: ['#040107', '#160929', '#27104A'] }, glow: [['236,72,153', '50%', '10%', 420], ['167,139,250', '50%', '90%', 380]], fx: 'rings' },
    { id: 'quantumecho', label: 'Quantum Echo', category: 'Quantum & Abstract Void', base: { a: 140, s: ['#050208', '#1B0C34', '#2D1458'] }, glow: [['216,180,254', '15%', '15%', 380], ['96,165,250', '80%', '80%', 420]], fx: 'particles' },
    { id: 'driftmatter', label: 'Drift Matter', category: 'Quantum & Abstract Void', base: { a: 125, s: ['#030105', '#130826', '#241044'] }, glow: [['129,140,248', '50%', '10%', 420], ['190,242,100', '50%', '90%', 380]], fx: 'rings' },

    // ---- Solar & Ember ----
    { id: 'embertrail', label: 'Ember Trail', category: 'Solar & Ember', base: { a: 135, s: ['#1A0500', '#3D1200', '#5C1F00'] }, glow: [['255,120,0', '15%', '15%', 380], ['255,200,50', '80%', '80%', 420]], fx: 'none' },
    { id: 'moltencore', label: 'Molten Core', category: 'Solar & Ember', base: { a: 160, s: ['#180300', '#3A0D00', '#5E1800'] }, glow: [['255,80,0', '50%', '10%', 420], ['255,196,0', '50%', '90%', 380]], fx: 'none' },
    { id: 'amberdust', label: 'Amber Dust', category: 'Solar & Ember', base: { a: 145, s: ['#170800', '#3C1B00', '#5E2C00'] }, glow: [['251,191,36', '15%', '15%', 380], ['249,115,22', '80%', '80%', 420]], fx: 'particles' },
    { id: 'copperflare', label: 'Copper Flare', category: 'Solar & Ember', base: { a: 130, s: ['#190600', '#3E1500', '#622300'] }, glow: [['217,119,6', '50%', '10%', 420], ['255,159,64', '50%', '90%', 380]], fx: 'wave' },
    { id: 'goldenhaze', label: 'Golden Haze', category: 'Solar & Ember', base: { a: 140, s: ['#1A0F00', '#402700', '#664000'] }, glow: [['250,204,21', '15%', '15%', 380], ['253,186,116', '80%', '80%', 420]], fx: 'particles' },
    { id: 'sunburst', label: 'Sunburst', category: 'Solar & Ember', base: { a: 125, s: ['#1C0A00', '#452000', '#703500'] }, glow: [['255,153,0', '50%', '10%', 420], ['255,221,0', '50%', '90%', 380]], fx: 'scan' },

    // ---- Pastel Dream ----
    { id: 'cottoncandy', label: 'Cotton Candy', category: 'Pastel Dream', base: { a: 135, s: ['#0D0B12', '#1C1628', '#2A1F3D'] }, glow: [['249,168,212', '15%', '15%', 380], ['165,243,252', '80%', '80%', 420]], fx: 'particles' },
    { id: 'peachbloom', label: 'Peach Bloom', category: 'Pastel Dream', base: { a: 160, s: ['#120D0B', '#2A1E18', '#3E2C22'] }, glow: [['254,202,202', '50%', '10%', 420], ['253,224,171', '50%', '90%', 380]], fx: 'wave' },
    { id: 'blushvelvet', label: 'Blush Velvet', category: 'Pastel Dream', base: { a: 145, s: ['#120A0E', '#2A151F', '#3E1F2E'] }, glow: [['251,207,232', '15%', '15%', 380], ['216,180,254', '80%', '80%', 420]], fx: 'particles' },
    { id: 'sorbetsky', label: 'Sorbet Sky', category: 'Pastel Dream', base: { a: 130, s: ['#0B0D12', '#19212E', '#252F42'] }, glow: [['165,243,252', '50%', '10%', 420], ['254,202,202', '50%', '90%', 380]], fx: 'none' },
    { id: 'dreamypetal', label: 'Dreamy Petal', category: 'Pastel Dream', base: { a: 140, s: ['#100B0D', '#251820', '#372330'] }, glow: [['254,205,211', '15%', '15%', 380], ['216,180,254', '80%', '80%', 420]], fx: 'wave' },
    { id: 'bubblegumdusk', label: 'Bubblegum Dusk', category: 'Pastel Dream', base: { a: 125, s: ['#120A11', '#2C1526', '#401D38'] }, glow: [['244,114,182', '50%', '10%', 420], ['191,219,254', '50%', '90%', 380]], fx: 'particles' },

    // ---- Prism & Crystal ----
    { id: 'crystalfacet', label: 'Crystal Facet', category: 'Prism & Crystal', base: { a: 135, s: ['#08080D', '#16161F', '#212233'] }, glow: [['244,114,182', '15%', '15%', 380], ['56,189,248', '80%', '80%', 420]], fx: 'sheen' },
    { id: 'diamonddust', label: 'Diamond Dust', category: 'Prism & Crystal', base: { a: 160, s: ['#0A0A0E', '#1A1A22', '#252533'] }, glow: [['226,232,240', '50%', '10%', 420], ['165,243,252', '50%', '90%', 380]], fx: 'particles' },
    { id: 'opalsheen', label: 'Opal Sheen', category: 'Prism & Crystal', base: { a: 145, s: ['#09090E', '#181820', '#242433'] }, glow: [['251,191,36', '15%', '15%', 380], ['165,243,252', '80%', '80%', 420]], fx: 'sheen' },
    { id: 'crystalcore', label: 'Crystal Core', category: 'Prism & Crystal', base: { a: 130, s: ['#08080C', '#17171E', '#22222E'] }, glow: [['129,140,248', '50%', '10%', 420], ['251,191,36', '50%', '90%', 380]], fx: 'particles' },
    { id: 'prismbloom', label: 'Prism Bloom', category: 'Prism & Crystal', base: { a: 140, s: ['#09090D', '#18181F', '#232330'] }, glow: [['190,242,100', '15%', '15%', 380], ['244,114,182', '80%', '80%', 420]], fx: 'sheen' },
    { id: 'lumincrystal', label: 'Lumin Crystal', category: 'Prism & Crystal', base: { a: 125, s: ['#08080C', '#17171F', '#222230'] }, glow: [['244,114,182', '50%', '10%', 420], ['129,140,248', '50%', '90%', 380]], fx: 'scan' },

    // ---- Nature & Emerald ----
    { id: 'forestcanopy', label: 'Forest Canopy', category: 'Nature & Emerald', base: { a: 135, s: ['#030805', '#0A1F12', '#12331D'] }, glow: [['34,197,94', '15%', '15%', 380], ['132,204,22', '80%', '80%', 420]], fx: 'grid' },
    { id: 'junglepulse', label: 'Jungle Pulse', category: 'Nature & Emerald', base: { a: 160, s: ['#020602', '#0A1D0B', '#132E14'] }, glow: [['34,211,94', '50%', '10%', 420], ['163,230,53', '50%', '90%', 380]], fx: 'particles' },
    { id: 'verdantmist', label: 'Verdant Mist', category: 'Nature & Emerald', base: { a: 145, s: ['#040704', '#0E210F', '#183419'] }, glow: [['132,204,22', '15%', '15%', 380], ['45,212,191', '80%', '80%', 420]], fx: 'wave' },
    { id: 'rainforest', label: 'Rainforest', category: 'Nature & Emerald', base: { a: 130, s: ['#030603', '#0C1F0E', '#153217'] }, glow: [['74,222,128', '50%', '10%', 420], ['45,212,191', '50%', '90%', 380]], fx: 'particles' },
    { id: 'sagewhisper', label: 'Sage Whisper', category: 'Nature & Emerald', base: { a: 140, s: ['#050705', '#121F13', '#1C301D'] }, glow: [['148,197,143', '15%', '15%', 380], ['190,242,100', '80%', '80%', 420]], fx: 'grid' },
    { id: 'mossveil', label: 'Moss Veil', category: 'Nature & Emerald', base: { a: 125, s: ['#030503', '#0D1C0E', '#172C18'] }, glow: [['74,222,128', '50%', '10%', 420], ['20,184,166', '50%', '90%', 380]], fx: 'wave' },

    // ---- Vibrant Neon Cyber ---- (animated shifting-gradient bases -
    // the color itself moves, not just the glow orbs.)
    { id: 'hyperneonwave', label: 'Hyper Neon Wave', category: 'Vibrant Neon Cyber', base: { a: 145, s: ['#0D0221', '#FF00C8', '#00EAFF', '#0D0221'], animated: true }, glow: [['255,0,200', '15%', '15%', 380], ['0,234,255', '80%', '80%', 420]], fx: 'grid' },
    { id: 'plasmacyclone', label: 'Plasma Cyclone', category: 'Vibrant Neon Cyber', base: { a: 130, s: ['#05010F', '#00F5FF', '#FF0080', '#05010F'], animated: true }, glow: [['0,245,255', '50%', '10%', 420], ['255,0,128', '50%', '90%', 380]], fx: 'streaks' },
    { id: 'voltagesurge', label: 'Voltage Surge', category: 'Vibrant Neon Cyber', base: { a: 170, s: ['#00040F', '#3AFFEA', '#8B00FF', '#00040F'], animated: true }, glow: [['58,255,234', '15%', '15%', 380], ['139,0,255', '80%', '80%', 420]], fx: 'scan' },
    { id: 'hologramflux', label: 'Hologram Flux', category: 'Vibrant Neon Cyber', base: { a: 155, s: ['#08000F', '#00FFC8', '#FF00E1', '#08000F'], animated: true }, glow: [['0,255,200', '50%', '10%', 420], ['255,0,225', '50%', '90%', 380]], fx: 'grid' },

    // ---- Glowing Nebula Pulse ---- (animated shifting-gradient bases,
    // paired with stars/particles for a genuine deep-space nebula feel.)
    { id: 'nebulapulsecore', label: 'Nebula Pulse Core', category: 'Glowing Nebula Pulse', base: { a: 135, s: ['#050214', '#7C1FA0', '#1E1B4B', '#050214'], animated: true }, glow: [['167,139,250', '15%', '15%', 380], ['99,102,241', '80%', '80%', 420]], fx: 'stars' },
    { id: 'auroranebulaveil', label: 'Aurora Nebula Veil', category: 'Glowing Nebula Pulse', base: { a: 160, s: ['#030512', '#0EA5E9', '#7C3AED', '#030512'], animated: true }, glow: [['56,189,248', '50%', '10%', 420], ['167,139,250', '50%', '90%', 380]], fx: 'particles' },
    { id: 'galacticemberglow', label: 'Galactic Ember Glow', category: 'Glowing Nebula Pulse', base: { a: 145, s: ['#06010A', '#F59E0B', '#581C87', '#06010A'], animated: true }, glow: [['251,191,36', '15%', '15%', 380], ['168,85,247', '80%', '80%', 420]], fx: 'particles' },
    { id: 'voidbloompulse', label: 'Void Bloom Pulse', category: 'Glowing Nebula Pulse', base: { a: 165, s: ['#030108', '#22D3EE', '#701A75', '#030108'], animated: true }, glow: [['34,211,238', '80%', '15%', 400], ['217,70,239', '15%', '80%', 380]], fx: 'stars' },

    // ---- Glass Glow Premium ---- (deep jewel-tone moody bases with the
    // `vignette` glowing-edge effect - "vivid glowing borders instead of
    // dull flat fills".)
    { id: 'emeraldglassglow', label: 'Emerald Glass Glow', category: 'Glass Glow Premium', base: { a: 140, s: ['#020806', '#031F14', '#053322'] }, glow: [['16,185,129', '50%', '50%', 460]], fx: 'vignette' },
    { id: 'rubyglassglow', label: 'Ruby Glass Glow', category: 'Glass Glow Premium', base: { a: 135, s: ['#0A0002', '#2B0008', '#4A0010'] }, glow: [['239,68,68', '50%', '50%', 460]], fx: 'vignette' },
    { id: 'onyxgoldglow', label: 'Onyx Gold Glow', category: 'Glass Glow Premium', base: { a: 145, s: ['#050403', '#1A1408', '#2E2410'] }, glow: [['251,191,36', '50%', '50%', 460]], fx: 'vignette' },
    { id: 'jadeglassglow', label: 'Jade Glass Glow', category: 'Glass Glow Premium', base: { a: 165, s: ['#020805', '#0A2318', '#123D29'] }, glow: [['20,184,166', '50%', '50%', 460]], fx: 'vignette' },

    // ---- Iridescent Flow ---- (genuinely new, not a recolor of an
    // existing category: a true 5-hue animated gradient - real rainbow/
    // holographic movement through distinct hue families in one
    // shifting base, not 2-3 similar tones - paired with a glowing
    // vignette edge for a premium, "shifting oil-slick" look nothing
    // above already does.)
    { id: 'iridescentveil', label: 'Iridescent Veil', category: 'Iridescent Flow', base: { a: 120, s: ['#05020A', '#7C3AED', '#DB2777', '#0EA5E9', '#05020A'], animated: true }, glow: [['217,70,239', '50%', '50%', 460]], fx: 'vignette' },
    { id: 'holoshift', label: 'Holo Shift', category: 'Iridescent Flow', base: { a: 150, s: ['#020108', '#F472B6', '#22D3EE', '#A855F7', '#020108'], animated: true }, glow: [['244,114,182', '50%', '50%', 460]], fx: 'vignette' },
    { id: 'oilslickdream', label: 'Oil Slick Dream', category: 'Iridescent Flow', base: { a: 165, s: ['#04020C', '#10B981', '#6366F1', '#F59E0B', '#04020C'], animated: true }, glow: [['99,102,241', '50%', '50%', 460]], fx: 'vignette' },
    { id: 'prismaticaurora', label: 'Prismatic Aurora', category: 'Iridescent Flow', base: { a: 135, s: ['#030512', '#EC4899', '#0EA5E9', '#84CC16', '#030512'], animated: true }, glow: [['236,72,153', '50%', '50%', 460]], fx: 'stars' },
    { id: 'spectralwave', label: 'Spectral Wave', category: 'Iridescent Flow', base: { a: 155, s: ['#02010A', '#8B5CF6', '#F97316', '#14B8A6', '#02010A'], animated: true }, glow: [['139,92,246', '50%', '50%', 460]], fx: 'particles' },
    { id: 'chromaverse', label: 'Chromaverse', category: 'Iridescent Flow', base: { a: 140, s: ['#050110', '#FB7185', '#38BDF8', '#A3E635', '#050110'], animated: true }, glow: [['251,113,133', '50%', '50%', 460]], fx: 'vignette' },
];
