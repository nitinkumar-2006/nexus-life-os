// src/components/MobileHeaderSearch.jsx
//
// The mobile Spotlight-style search, moved here from its old spot at the
// very top of the Home page's own content (see HomePage.jsx's git
// history) into the header itself, per explicit request - mobile's
// header used to leave a genuinely empty gap between the hamburger/
// wordmark on the left and the notification/profile cluster on the
// right (desktop fills that exact same middle slot with the "System
// Active & Ready" pill, which is hidden on mobile - see header.jsx),
// and a real navigation search belongs in the header the same way
// desktop's own Spotlight search already lives there.
//
// A small, icon-only trigger (matching the plain 38px circular icon
// buttons already used for Quick Notes/Notifications/Theme) that now
// lives as a normal member of that same right-hand icon row in
// header.jsx (sharing its one uniform gap), not centered alone in a
// separate flex:1 middle slot the way it originally was - a real,
// reported bug was that centering a single icon in "whatever space is
// left over" produced visibly uneven gaps to its neighbors (sometimes
// hugging the wordmark, sometimes hugging Quick Notes, depending on how
// much room the two side groups happened to leave). Tapping it opens a
// real, roomy dropdown with the actual input and results, anchored
// below the header - see the fixed-position math on that dropdown
// below, which is deliberately NOT relative to this trigger's own now-
// tiny wrapper box (a wide dropdown centered on a 38px anchor needs
// viewport-relative positioning, not container-relative offsets sized
// for the old, much wider flex:1 box).
import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';

const SPOTLIGHT_SECTIONS = [
    { name: 'Home Dashboard', route: 'Home' },
    { name: 'Planner Matrix', route: 'Planner' },
    { name: 'Study Hub', route: 'Study' },
    { name: 'Syllabus', route: 'Syllabus' },
    { name: 'Gym & Fitness', route: 'Gym' },
    { name: 'Diet & Nutrition', route: 'Diet' },
    { name: 'Finance Wallet', route: 'Finance' },
    { name: 'Calendar', route: 'Calendar' },
    { name: 'Analytics', route: 'Analytics' },
    { name: 'AI Intelligence Hub', route: 'AI' },
    { name: 'User Profile', route: 'Profile' },
    { name: 'System Settings', route: 'Settings' },
];

const MobileHeaderSearch = ({ setActiveTab }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const wrapRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) { setIsOpen(false); setQuery(''); }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Focuses the real input the instant the dropdown mounts, so opening
    // the trigger and typing feels like one continuous action rather
    // than needing a second, separate tap to focus the field.
    useEffect(() => {
        if (isOpen) inputRef.current?.focus();
    }, [isOpen]);

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return SPOTLIGHT_SECTIONS.map((s) => ({ title: s.name, route: s.route, type: 'Section' }));
        const matches = SPOTLIGHT_SECTIONS.filter((s) => s.name.toLowerCase().includes(q)).map((s) => ({ title: s.name, route: s.route, type: 'Section' }));
        try {
            const planner = JSON.parse(localStorage.getItem('nexus_planner_tasks') || '[]');
            planner.forEach((t) => {
                if (t.title && t.title.toLowerCase().includes(q)) matches.push({ title: t.title, route: 'Planner', type: 'Task' });
            });
        } catch (e) { /* malformed planner data - section matches above still work */ }
        return matches;
    }, [query]);

    const handleSelect = (route) => {
        if (typeof setActiveTab === 'function') setActiveTab(route);
        setIsOpen(false);
        setQuery('');
    };

    return (
        <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0, display: 'flex' }}>
            <button
                type="button"
                onClick={() => setIsOpen((v) => !v)}
                aria-label="Search Nexus"
                title="Search"
                data-tour-id="home-search"
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    width: '38px', height: '38px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)',
                    borderRadius: '50%', cursor: 'pointer', color: 'var(--text-secondary)', WebkitAppRegion: 'no-drag',
                }}
            >
                <Search size={17} />
            </button>

            {isOpen && (
                <div style={{
                    position: 'fixed', top: 'calc(60px + env(safe-area-inset-top, 0px) + 8px)', left: '12px', right: '12px', maxHeight: '70vh', overflowY: 'auto',
                    background: 'var(--bg-surface)', backdropFilter: 'blur(var(--glass-blur, 16px)) saturate(105%)', WebkitBackdropFilter: 'blur(var(--glass-blur, 16px)) saturate(105%)',
                    border: '1px solid var(--border-premium)', borderRadius: '16px', padding: '10px', zIndex: 1100,
                    boxShadow: '0 10px 25px rgba(0,0,0,0.3)', WebkitAppRegion: 'no-drag',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--widget-bg)', padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border-premium)', marginBottom: '8px' }}>
                        <Search size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                        <input
                            ref={inputRef}
                            id="mobile-header-search" name="mobileHeaderSearch"
                            type="text" aria-label="Search Nexus"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && results[0]) { e.preventDefault(); handleSelect(results[0].route); }
                                else if (e.key === 'Escape') { setIsOpen(false); setQuery(''); }
                            }}
                            placeholder="Search Nexus..."
                            style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '15px', lineHeight: '20px', fontWeight: '500', outline: 'none' }}
                        />
                        {query && (
                            <button onClick={() => setQuery('')} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
                                <X size={15} />
                            </button>
                        )}
                    </div>

                    {results.slice(0, 8).map((res, idx) => (
                        <div
                            key={`${res.route}_${idx}`}
                            onClick={() => handleSelect(res.route)}
                            style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '11px 12px', borderRadius: '12px', background: 'var(--widget-bg)',
                                color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', marginBottom: '4px',
                            }}
                        >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{res.title}</span>
                            <span style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--bg-main)', borderRadius: '4px', color: 'var(--accent)', flexShrink: 0, marginLeft: '8px' }}>{res.type}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MobileHeaderSearch;
