// src/constants/fontOptions.js
//
// The real, curated font library for Settings' Typography & Styling
// section. Every entry with a `googleFont` value is a genuine, currently
// published Google Font - `googleFont` is the exact family name used to
// build the real fonts.googleapis.com stylesheet URL (see
// utils/fontLoader.js), not a decorative label. Two entries (Satoshi,
// General Sans) are real fonts but are NOT on Google Fonts - they're
// hosted on Fontshare, a different free font CDN - so those use `fontshare`
// instead of `googleFont`; the loader knows to build a different URL for
// those specifically. The four "Apple & Premium" entries are real system
// fonts, not web-loadable at all (Apple's license doesn't permit
// redistributing San Francisco or Helvetica Neue via a font CDN) - those
// have neither `googleFont` nor `fontshare` set, and resolve entirely via
// the OS's own installed fonts through their `stack`, exactly the way any
// native macOS/iOS app references them. Nothing here is a placeholder that
// silently fails to load; every entry either genuinely fetches a real
// stylesheet or genuinely already has its font available locally.
//
// IMPORTANT for future edits: every existing `id` below is a real,
// currently-saved value inside some users' own `nexus_global_settings`
// (localStorage) - getFontOption falls back to the default font for any
// id it doesn't recognize, so renaming or removing an id silently resets
// that user's font choice next time they open the app. Only ever APPEND
// new entries; never rename or delete an existing id.
export const FONT_OPTIONS = [
    // --- Modern Sans-Serif ---
    { id: 'inter', label: 'Inter', category: 'Modern Sans-Serif', googleFont: 'Inter', weights: '300;400;500;600;700;800', stack: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" },
    { id: 'roboto', label: 'Roboto', category: 'Modern Sans-Serif', googleFont: 'Roboto', weights: '300;400;500;700', stack: "'Roboto', -apple-system, sans-serif" },
    { id: 'open-sans', label: 'Open Sans', category: 'Modern Sans-Serif', googleFont: 'Open Sans', weights: '300;400;500;600;700', stack: "'Open Sans', -apple-system, sans-serif" },
    { id: 'lato', label: 'Lato', category: 'Modern Sans-Serif', googleFont: 'Lato', weights: '300;400;700', stack: "'Lato', -apple-system, sans-serif" },
    { id: 'montserrat', label: 'Montserrat', category: 'Modern Sans-Serif', googleFont: 'Montserrat', weights: '300;400;500;600;700;800', stack: "'Montserrat', -apple-system, sans-serif" },
    { id: 'poppins', label: 'Poppins', category: 'Modern Sans-Serif', googleFont: 'Poppins', weights: '300;400;500;600;700', stack: "'Poppins', -apple-system, sans-serif" },
    { id: 'plus-jakarta-sans', label: 'Plus Jakarta Sans', category: 'Modern Sans-Serif', googleFont: 'Plus Jakarta Sans', weights: '300;400;500;600;700;800', stack: "'Plus Jakarta Sans', -apple-system, sans-serif" },
    { id: 'outfit', label: 'Outfit', category: 'Modern Sans-Serif', googleFont: 'Outfit', weights: '300;400;500;600;700;800', stack: "'Outfit', -apple-system, sans-serif" },
    { id: 'work-sans', label: 'Work Sans', category: 'Modern Sans-Serif', googleFont: 'Work Sans', weights: '300;400;500;600;700', stack: "'Work Sans', -apple-system, sans-serif" },
    { id: 'dm-sans', label: 'DM Sans', category: 'Modern Sans-Serif', googleFont: 'DM Sans', weights: '400;500;700', stack: "'DM Sans', -apple-system, sans-serif" },
    { id: 'nunito', label: 'Nunito', category: 'Modern Sans-Serif', googleFont: 'Nunito', weights: '300;400;600;700;800', stack: "'Nunito', -apple-system, sans-serif" },
    { id: 'quicksand', label: 'Quicksand', category: 'Modern Sans-Serif', googleFont: 'Quicksand', weights: '400;500;600;700', stack: "'Quicksand', -apple-system, sans-serif" },
    { id: 'urbanist', label: 'Urbanist', category: 'Modern Sans-Serif', googleFont: 'Urbanist', weights: '300;400;500;600;700;800', stack: "'Urbanist', -apple-system, sans-serif" },
    { id: 'space-grotesk', label: 'Space Grotesk', category: 'Modern Sans-Serif', googleFont: 'Space Grotesk', weights: '300;400;500;600;700', stack: "'Space Grotesk', -apple-system, sans-serif" },
    { id: 'syne', label: 'Syne', category: 'Modern Sans-Serif', googleFont: 'Syne', weights: '400;500;600;700;800', stack: "'Syne', -apple-system, sans-serif" },
    { id: 'sora', label: 'Sora', category: 'Modern Sans-Serif', googleFont: 'Sora', weights: '300;400;500;600;700;800', stack: "'Sora', -apple-system, sans-serif" },
    { id: 'general-sans', label: 'General Sans', category: 'Modern Sans-Serif', fontshare: 'general-sans', weights: '400,500,600,700', stack: "'General Sans', -apple-system, sans-serif" },
    { id: 'satoshi', label: 'Satoshi', category: 'Modern Sans-Serif', fontshare: 'satoshi', weights: '400,500,700,900', stack: "'Satoshi', -apple-system, sans-serif" },
    { id: 'manrope', label: 'Manrope', category: 'Modern Sans-Serif', googleFont: 'Manrope', weights: '300;400;500;600;700;800', stack: "'Manrope', -apple-system, sans-serif" },
    { id: 'rubik', label: 'Rubik', category: 'Modern Sans-Serif', googleFont: 'Rubik', weights: '300;400;500;600;700;800', stack: "'Rubik', -apple-system, sans-serif" },
    { id: 'karla', label: 'Karla', category: 'Modern Sans-Serif', googleFont: 'Karla', weights: '300;400;500;600;700;800', stack: "'Karla', -apple-system, sans-serif" },
    { id: 'mulish', label: 'Mulish', category: 'Modern Sans-Serif', googleFont: 'Mulish', weights: '300;400;500;600;700;800', stack: "'Mulish', -apple-system, sans-serif" },
    { id: 'barlow', label: 'Barlow', category: 'Modern Sans-Serif', googleFont: 'Barlow', weights: '300;400;500;600;700;800', stack: "'Barlow', -apple-system, sans-serif" },
    { id: 'heebo', label: 'Heebo', category: 'Modern Sans-Serif', googleFont: 'Heebo', weights: '300;400;500;600;700;800', stack: "'Heebo', -apple-system, sans-serif" },
    { id: 'figtree', label: 'Figtree', category: 'Modern Sans-Serif', googleFont: 'Figtree', weights: '300;400;500;600;700;800', stack: "'Figtree', -apple-system, sans-serif" },
    { id: 'epilogue', label: 'Epilogue', category: 'Modern Sans-Serif', googleFont: 'Epilogue', weights: '300;400;500;600;700;800', stack: "'Epilogue', -apple-system, sans-serif" },
    { id: 'red-hat-display', label: 'Red Hat Display', category: 'Modern Sans-Serif', googleFont: 'Red Hat Display', weights: '400;500;600;700;800', stack: "'Red Hat Display', -apple-system, sans-serif" },
    { id: 'red-hat-text', label: 'Red Hat Text', category: 'Modern Sans-Serif', googleFont: 'Red Hat Text', weights: '400;500;600;700', stack: "'Red Hat Text', -apple-system, sans-serif" },
    { id: 'public-sans', label: 'Public Sans', category: 'Modern Sans-Serif', googleFont: 'Public Sans', weights: '300;400;500;600;700;800', stack: "'Public Sans', -apple-system, sans-serif" },
    { id: 'ibm-plex-sans', label: 'IBM Plex Sans', category: 'Modern Sans-Serif', googleFont: 'IBM Plex Sans', weights: '300;400;500;600;700', stack: "'IBM Plex Sans', -apple-system, sans-serif" },
    { id: 'noto-sans', label: 'Noto Sans', category: 'Modern Sans-Serif', googleFont: 'Noto Sans', weights: '400;500;600;700', stack: "'Noto Sans', -apple-system, sans-serif" },
    { id: 'pt-sans', label: 'PT Sans', category: 'Modern Sans-Serif', googleFont: 'PT Sans', weights: '400;700', stack: "'PT Sans', -apple-system, sans-serif" },
    { id: 'source-sans-3', label: 'Source Sans 3', category: 'Modern Sans-Serif', googleFont: 'Source Sans 3', weights: '300;400;500;600;700', stack: "'Source Sans 3', -apple-system, sans-serif" },
    { id: 'raleway', label: 'Raleway', category: 'Modern Sans-Serif', googleFont: 'Raleway', weights: '300;400;500;600;700;800', stack: "'Raleway', -apple-system, sans-serif" },
    { id: 'josefin-sans', label: 'Josefin Sans', category: 'Modern Sans-Serif', googleFont: 'Josefin Sans', weights: '300;400;500;600;700', stack: "'Josefin Sans', -apple-system, sans-serif" },
    { id: 'hind', label: 'Hind', category: 'Modern Sans-Serif', googleFont: 'Hind', weights: '300;400;500;600;700', stack: "'Hind', -apple-system, sans-serif" },
    { id: 'cabin', label: 'Cabin', category: 'Modern Sans-Serif', googleFont: 'Cabin', weights: '400;500;600;700', stack: "'Cabin', -apple-system, sans-serif" },
    { id: 'jost', label: 'Jost', category: 'Modern Sans-Serif', googleFont: 'Jost', weights: '300;400;500;600;700', stack: "'Jost', -apple-system, sans-serif" },
    { id: 'archivo', label: 'Archivo', category: 'Modern Sans-Serif', googleFont: 'Archivo', weights: '300;400;500;600;700;800', stack: "'Archivo', -apple-system, sans-serif" },
    { id: 'overpass', label: 'Overpass', category: 'Modern Sans-Serif', googleFont: 'Overpass', weights: '300;400;500;600;700', stack: "'Overpass', -apple-system, sans-serif" },
    { id: 'exo-2', label: 'Exo 2', category: 'Modern Sans-Serif', googleFont: 'Exo 2', weights: '300;400;500;600;700;800', stack: "'Exo 2', -apple-system, sans-serif" },
    { id: 'saira', label: 'Saira', category: 'Modern Sans-Serif', googleFont: 'Saira', weights: '300;400;500;600;700;800', stack: "'Saira', -apple-system, sans-serif" },
    { id: 'chivo', label: 'Chivo', category: 'Modern Sans-Serif', googleFont: 'Chivo', weights: '300;400;500;600;700', stack: "'Chivo', -apple-system, sans-serif" },
    { id: 'be-vietnam-pro', label: 'Be Vietnam Pro', category: 'Modern Sans-Serif', googleFont: 'Be Vietnam Pro', weights: '300;400;500;600;700;800', stack: "'Be Vietnam Pro', -apple-system, sans-serif" },
    { id: 'instrument-sans', label: 'Instrument Sans', category: 'Modern Sans-Serif', googleFont: 'Instrument Sans', weights: '400;500;600;700', stack: "'Instrument Sans', -apple-system, sans-serif" },
    { id: 'albert-sans', label: 'Albert Sans', category: 'Modern Sans-Serif', googleFont: 'Albert Sans', weights: '300;400;500;600;700;800', stack: "'Albert Sans', -apple-system, sans-serif" },
    { id: 'lexend', label: 'Lexend', category: 'Modern Sans-Serif', googleFont: 'Lexend', weights: '300;400;500;600;700;800', stack: "'Lexend', -apple-system, sans-serif" },
    { id: 'bricolage-grotesque', label: 'Bricolage Grotesque', category: 'Modern Sans-Serif', googleFont: 'Bricolage Grotesque', weights: '400;500;600;700;800', stack: "'Bricolage Grotesque', -apple-system, sans-serif" },

    // --- Clean Serif & Editorial ---
    { id: 'playfair-display', label: 'Playfair Display', category: 'Clean Serif & Editorial', googleFont: 'Playfair Display', weights: '400;500;600;700', stack: "'Playfair Display', Georgia, serif" },
    { id: 'merriweather', label: 'Merriweather', category: 'Clean Serif & Editorial', googleFont: 'Merriweather', weights: '300;400;700', stack: "'Merriweather', Georgia, serif" },
    { id: 'lora', label: 'Lora', category: 'Clean Serif & Editorial', googleFont: 'Lora', weights: '400;500;600;700', stack: "'Lora', Georgia, serif" },
    { id: 'cormorant-garamond', label: 'Cormorant Garamond', category: 'Clean Serif & Editorial', googleFont: 'Cormorant Garamond', weights: '400;500;600;700', stack: "'Cormorant Garamond', Georgia, serif" },
    { id: 'cinzel', label: 'Cinzel', category: 'Clean Serif & Editorial', googleFont: 'Cinzel', weights: '400;500;600;700', stack: "'Cinzel', Georgia, serif" },
    { id: 'newsreader', label: 'Newsreader', category: 'Clean Serif & Editorial', googleFont: 'Newsreader', weights: '400;500;600;700', stack: "'Newsreader', Georgia, serif" },
    { id: 'libre-baskerville', label: 'Libre Baskerville', category: 'Clean Serif & Editorial', googleFont: 'Libre Baskerville', weights: '400;700', stack: "'Libre Baskerville', Georgia, serif" },
    { id: 'pt-serif', label: 'PT Serif', category: 'Clean Serif & Editorial', googleFont: 'PT Serif', weights: '400;700', stack: "'PT Serif', Georgia, serif" },
    { id: 'noto-serif', label: 'Noto Serif', category: 'Clean Serif & Editorial', googleFont: 'Noto Serif', weights: '400;500;600;700', stack: "'Noto Serif', Georgia, serif" },
    { id: 'source-serif-4', label: 'Source Serif 4', category: 'Clean Serif & Editorial', googleFont: 'Source Serif 4', weights: '300;400;500;600;700', stack: "'Source Serif 4', Georgia, serif" },
    { id: 'crimson-text', label: 'Crimson Text', category: 'Clean Serif & Editorial', googleFont: 'Crimson Text', weights: '400;600;700', stack: "'Crimson Text', Georgia, serif" },
    { id: 'crimson-pro', label: 'Crimson Pro', category: 'Clean Serif & Editorial', googleFont: 'Crimson Pro', weights: '300;400;500;600;700', stack: "'Crimson Pro', Georgia, serif" },
    { id: 'eb-garamond', label: 'EB Garamond', category: 'Clean Serif & Editorial', googleFont: 'EB Garamond', weights: '400;500;600;700', stack: "'EB Garamond', Georgia, serif" },
    { id: 'bitter', label: 'Bitter', category: 'Clean Serif & Editorial', googleFont: 'Bitter', weights: '300;400;500;600;700', stack: "'Bitter', Georgia, serif" },
    { id: 'domine', label: 'Domine', category: 'Clean Serif & Editorial', googleFont: 'Domine', weights: '400;500;600;700', stack: "'Domine', Georgia, serif" },
    { id: 'spectral', label: 'Spectral', category: 'Clean Serif & Editorial', googleFont: 'Spectral', weights: '300;400;500;600;700', stack: "'Spectral', Georgia, serif" },
    { id: 'frank-ruhl-libre', label: 'Frank Ruhl Libre', category: 'Clean Serif & Editorial', googleFont: 'Frank Ruhl Libre', weights: '400;500;700', stack: "'Frank Ruhl Libre', Georgia, serif" },
    { id: 'vollkorn', label: 'Vollkorn', category: 'Clean Serif & Editorial', googleFont: 'Vollkorn', weights: '400;500;600;700', stack: "'Vollkorn', Georgia, serif" },
    { id: 'alegreya', label: 'Alegreya', category: 'Clean Serif & Editorial', googleFont: 'Alegreya', weights: '400;500;600;700', stack: "'Alegreya', Georgia, serif" },
    { id: 'fraunces', label: 'Fraunces', category: 'Clean Serif & Editorial', googleFont: 'Fraunces', weights: '300;400;500;600;700', stack: "'Fraunces', Georgia, serif" },
    { id: 'cormorant', label: 'Cormorant', category: 'Clean Serif & Editorial', googleFont: 'Cormorant', weights: '400;500;600;700', stack: "'Cormorant', Georgia, serif" },
    { id: 'gelasio', label: 'Gelasio', category: 'Clean Serif & Editorial', googleFont: 'Gelasio', weights: '400;500;600;700', stack: "'Gelasio', Georgia, serif" },
    { id: 'zilla-slab', label: 'Zilla Slab', category: 'Clean Serif & Editorial', googleFont: 'Zilla Slab', weights: '400;500;600;700', stack: "'Zilla Slab', Georgia, serif" },
    { id: 'roboto-slab', label: 'Roboto Slab', category: 'Clean Serif & Editorial', googleFont: 'Roboto Slab', weights: '300;400;500;600;700', stack: "'Roboto Slab', Georgia, serif" },
    { id: 'literata', label: 'Literata', category: 'Clean Serif & Editorial', googleFont: 'Literata', weights: '400;500;600;700', stack: "'Literata', Georgia, serif" },
    { id: 'dm-serif-text', label: 'DM Serif Text', category: 'Clean Serif & Editorial', googleFont: 'DM Serif Text', weights: '400', stack: "'DM Serif Text', Georgia, serif" },
    { id: 'bodoni-moda', label: 'Bodoni Moda', category: 'Clean Serif & Editorial', googleFont: 'Bodoni Moda', weights: '400;500;600;700', stack: "'Bodoni Moda', Georgia, serif" },
    { id: 'prata', label: 'Prata', category: 'Clean Serif & Editorial', googleFont: 'Prata', weights: '400', stack: "'Prata', Georgia, serif" },

    // --- Monospace & Technical ---
    { id: 'jetbrains-mono', label: 'JetBrains Mono', category: 'Monospace & Technical', googleFont: 'JetBrains Mono', weights: '400;500;600;700', stack: "'JetBrains Mono', 'SF Mono', monospace" },
    { id: 'fira-code', label: 'Fira Code', category: 'Monospace & Technical', googleFont: 'Fira Code', weights: '400;500;600;700', stack: "'Fira Code', 'SF Mono', monospace" },
    { id: 'source-code-pro', label: 'Source Code Pro', category: 'Monospace & Technical', googleFont: 'Source Code Pro', weights: '400;500;600;700', stack: "'Source Code Pro', 'SF Mono', monospace" },
    { id: 'space-mono', label: 'Space Mono', category: 'Monospace & Technical', googleFont: 'Space Mono', weights: '400;700', stack: "'Space Mono', 'SF Mono', monospace" },
    { id: 'ibm-plex-mono', label: 'IBM Plex Mono', category: 'Monospace & Technical', googleFont: 'IBM Plex Mono', weights: '400;500;600;700', stack: "'IBM Plex Mono', 'SF Mono', monospace" },
    { id: 'inconsolata', label: 'Inconsolata', category: 'Monospace & Technical', googleFont: 'Inconsolata', weights: '400;500;600;700', stack: "'Inconsolata', 'SF Mono', monospace" },
    { id: 'roboto-mono', label: 'Roboto Mono', category: 'Monospace & Technical', googleFont: 'Roboto Mono', weights: '300;400;500;600;700', stack: "'Roboto Mono', 'SF Mono', monospace" },
    { id: 'ubuntu-mono', label: 'Ubuntu Mono', category: 'Monospace & Technical', googleFont: 'Ubuntu Mono', weights: '400;700', stack: "'Ubuntu Mono', 'SF Mono', monospace" },
    { id: 'overpass-mono', label: 'Overpass Mono', category: 'Monospace & Technical', googleFont: 'Overpass Mono', weights: '300;400;500;600;700', stack: "'Overpass Mono', 'SF Mono', monospace" },
    { id: 'pt-mono', label: 'PT Mono', category: 'Monospace & Technical', googleFont: 'PT Mono', weights: '400', stack: "'PT Mono', 'SF Mono', monospace" },
    { id: 'noto-sans-mono', label: 'Noto Sans Mono', category: 'Monospace & Technical', googleFont: 'Noto Sans Mono', weights: '400;500;600;700', stack: "'Noto Sans Mono', 'SF Mono', monospace" },
    { id: 'azeret-mono', label: 'Azeret Mono', category: 'Monospace & Technical', googleFont: 'Azeret Mono', weights: '400;500;600;700', stack: "'Azeret Mono', 'SF Mono', monospace" },
    { id: 'dm-mono', label: 'DM Mono', category: 'Monospace & Technical', googleFont: 'DM Mono', weights: '400;500', stack: "'DM Mono', 'SF Mono', monospace" },
    { id: 'red-hat-mono', label: 'Red Hat Mono', category: 'Monospace & Technical', googleFont: 'Red Hat Mono', weights: '400;500;600;700', stack: "'Red Hat Mono', 'SF Mono', monospace" },
    { id: 'spline-sans-mono', label: 'Spline Sans Mono', category: 'Monospace & Technical', googleFont: 'Spline Sans Mono', weights: '400;500;600;700', stack: "'Spline Sans Mono', 'SF Mono', monospace" },
    { id: 'martian-mono', label: 'Martian Mono', category: 'Monospace & Technical', googleFont: 'Martian Mono', weights: '400;500;600;700', stack: "'Martian Mono', 'SF Mono', monospace" },
    { id: 'cousine', label: 'Cousine', category: 'Monospace & Technical', googleFont: 'Cousine', weights: '400;700', stack: "'Cousine', 'SF Mono', monospace" },

    // --- Display & Decorative (bold headline/poster faces - genuinely
    // mostly single-weight or narrow-weight-range display families, unlike
    // the text faces above, so `weights` below is intentionally short for
    // most of these rather than an oversight) ---
    { id: 'bebas-neue', label: 'Bebas Neue', category: 'Display & Decorative', googleFont: 'Bebas Neue', weights: '400', stack: "'Bebas Neue', Impact, sans-serif" },
    { id: 'anton', label: 'Anton', category: 'Display & Decorative', googleFont: 'Anton', weights: '400', stack: "'Anton', Impact, sans-serif" },
    { id: 'archivo-black', label: 'Archivo Black', category: 'Display & Decorative', googleFont: 'Archivo Black', weights: '400', stack: "'Archivo Black', Impact, sans-serif" },
    { id: 'passion-one', label: 'Passion One', category: 'Display & Decorative', googleFont: 'Passion One', weights: '400;700;900', stack: "'Passion One', Impact, sans-serif" },
    { id: 'alfa-slab-one', label: 'Alfa Slab One', category: 'Display & Decorative', googleFont: 'Alfa Slab One', weights: '400', stack: "'Alfa Slab One', Georgia, serif" },
    { id: 'righteous', label: 'Righteous', category: 'Display & Decorative', googleFont: 'Righteous', weights: '400', stack: "'Righteous', -apple-system, sans-serif" },
    { id: 'fjalla-one', label: 'Fjalla One', category: 'Display & Decorative', googleFont: 'Fjalla One', weights: '400', stack: "'Fjalla One', -apple-system, sans-serif" },
    { id: 'oswald', label: 'Oswald', category: 'Display & Decorative', googleFont: 'Oswald', weights: '300;400;500;600;700', stack: "'Oswald', -apple-system, sans-serif" },
    { id: 'staatliches', label: 'Staatliches', category: 'Display & Decorative', googleFont: 'Staatliches', weights: '400', stack: "'Staatliches', Impact, sans-serif" },
    { id: 'bungee', label: 'Bungee', category: 'Display & Decorative', googleFont: 'Bungee', weights: '400', stack: "'Bungee', -apple-system, sans-serif" },
    { id: 'bungee-shade', label: 'Bungee Shade', category: 'Display & Decorative', googleFont: 'Bungee Shade', weights: '400', stack: "'Bungee Shade', -apple-system, sans-serif" },
    { id: 'bangers', label: 'Bangers', category: 'Display & Decorative', googleFont: 'Bangers', weights: '400', stack: "'Bangers', Impact, sans-serif" },
    { id: 'fredoka', label: 'Fredoka', category: 'Display & Decorative', googleFont: 'Fredoka', weights: '300;400;500;600;700', stack: "'Fredoka', -apple-system, sans-serif" },
    { id: 'baloo-2', label: 'Baloo 2', category: 'Display & Decorative', googleFont: 'Baloo 2', weights: '400;500;600;700;800', stack: "'Baloo 2', -apple-system, sans-serif" },
    { id: 'lilita-one', label: 'Lilita One', category: 'Display & Decorative', googleFont: 'Lilita One', weights: '400', stack: "'Lilita One', -apple-system, sans-serif" },
    { id: 'paytone-one', label: 'Paytone One', category: 'Display & Decorative', googleFont: 'Paytone One', weights: '400', stack: "'Paytone One', -apple-system, sans-serif" },
    { id: 'abril-fatface', label: 'Abril Fatface', category: 'Display & Decorative', googleFont: 'Abril Fatface', weights: '400', stack: "'Abril Fatface', Georgia, serif" },
    { id: 'big-shoulders-display', label: 'Big Shoulders Display', category: 'Display & Decorative', googleFont: 'Big Shoulders Display', weights: '400;500;600;700;800;900', stack: "'Big Shoulders Display', -apple-system, sans-serif" },
    { id: 'shrikhand', label: 'Shrikhand', category: 'Display & Decorative', googleFont: 'Shrikhand', weights: '400', stack: "'Shrikhand', -apple-system, sans-serif" },
    { id: 'unbounded', label: 'Unbounded', category: 'Display & Decorative', googleFont: 'Unbounded', weights: '400;500;600;700;800;900', stack: "'Unbounded', -apple-system, sans-serif" },
    { id: 'chewy', label: 'Chewy', category: 'Display & Decorative', googleFont: 'Chewy', weights: '400', stack: "'Chewy', -apple-system, sans-serif" },
    { id: 'luckiest-guy', label: 'Luckiest Guy', category: 'Display & Decorative', googleFont: 'Luckiest Guy', weights: '400', stack: "'Luckiest Guy', Impact, sans-serif" },

    // --- Handwriting & Script (real casual/script Google Fonts - almost
    // all single-weight, matching their real published variants) ---
    { id: 'dancing-script', label: 'Dancing Script', category: 'Handwriting & Script', googleFont: 'Dancing Script', weights: '400;500;600;700', stack: "'Dancing Script', cursive" },
    { id: 'pacifico', label: 'Pacifico', category: 'Handwriting & Script', googleFont: 'Pacifico', weights: '400', stack: "'Pacifico', cursive" },
    { id: 'caveat', label: 'Caveat', category: 'Handwriting & Script', googleFont: 'Caveat', weights: '400;500;600;700', stack: "'Caveat', cursive" },
    { id: 'sacramento', label: 'Sacramento', category: 'Handwriting & Script', googleFont: 'Sacramento', weights: '400', stack: "'Sacramento', cursive" },
    { id: 'great-vibes', label: 'Great Vibes', category: 'Handwriting & Script', googleFont: 'Great Vibes', weights: '400', stack: "'Great Vibes', cursive" },
    { id: 'satisfy', label: 'Satisfy', category: 'Handwriting & Script', googleFont: 'Satisfy', weights: '400', stack: "'Satisfy', cursive" },
    { id: 'kalam', label: 'Kalam', category: 'Handwriting & Script', googleFont: 'Kalam', weights: '300;400;700', stack: "'Kalam', cursive" },
    { id: 'indie-flower', label: 'Indie Flower', category: 'Handwriting & Script', googleFont: 'Indie Flower', weights: '400', stack: "'Indie Flower', cursive" },
    { id: 'shadows-into-light', label: 'Shadows Into Light', category: 'Handwriting & Script', googleFont: 'Shadows Into Light', weights: '400', stack: "'Shadows Into Light', cursive" },
    { id: 'amatic-sc', label: 'Amatic SC', category: 'Handwriting & Script', googleFont: 'Amatic SC', weights: '400;700', stack: "'Amatic SC', cursive" },
    { id: 'permanent-marker', label: 'Permanent Marker', category: 'Handwriting & Script', googleFont: 'Permanent Marker', weights: '400', stack: "'Permanent Marker', cursive" },
    { id: 'homemade-apple', label: 'Homemade Apple', category: 'Handwriting & Script', googleFont: 'Homemade Apple', weights: '400', stack: "'Homemade Apple', cursive" },
    { id: 'reenie-beanie', label: 'Reenie Beanie', category: 'Handwriting & Script', googleFont: 'Reenie Beanie', weights: '400', stack: "'Reenie Beanie', cursive" },
    { id: 'courgette', label: 'Courgette', category: 'Handwriting & Script', googleFont: 'Courgette', weights: '400', stack: "'Courgette', cursive" },
    { id: 'cookie', label: 'Cookie', category: 'Handwriting & Script', googleFont: 'Cookie', weights: '400', stack: "'Cookie', cursive" },
    { id: 'kaushan-script', label: 'Kaushan Script', category: 'Handwriting & Script', googleFont: 'Kaushan Script', weights: '400', stack: "'Kaushan Script', cursive" },
    { id: 'yellowtail', label: 'Yellowtail', category: 'Handwriting & Script', googleFont: 'Yellowtail', weights: '400', stack: "'Yellowtail', cursive" },
    { id: 'allura', label: 'Allura', category: 'Handwriting & Script', googleFont: 'Allura', weights: '400', stack: "'Allura', cursive" },

    // --- Apple & Premium Ecosystem (real system fonts, not web-loadable -
    // resolves via the OS's own installed fonts, exactly like a native
    // macOS/iOS app referencing them; -apple-system/BlinkMacSystemFont IS
    // the real, standard CSS mechanism for "use the device's actual San
    // Francisco/SF Pro", not a placeholder substitute for it) ---
    { id: 'sf-pro-display', label: 'SF Pro Display', category: 'Apple & Premium', stack: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif" },
    { id: 'apple-system-ui', label: 'Apple System UI', category: 'Apple & Premium', stack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
    { id: 'helvetica-neue', label: 'Helvetica Neue', category: 'Apple & Premium', stack: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
    { id: 'futura', label: 'Futura', category: 'Apple & Premium', stack: "Futura, 'Century Gothic', -apple-system, sans-serif" },
];

export const FONT_CATEGORIES = [...new Set(FONT_OPTIONS.map((f) => f.category))];

export const DEFAULT_FONT_ID = 'inter';

export const getFontOption = (id) => FONT_OPTIONS.find((f) => f.id === id) || FONT_OPTIONS.find((f) => f.id === DEFAULT_FONT_ID);
