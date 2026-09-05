// src/components/settings/SettingCard.jsx
//
// The new accordion primitive for the redesigned Settings Hub -
// replaces SettingsPage.jsx's old SettingsSection (a plain
// {isOpen && <div>} snap) with the same real props/behavior, but a
// genuine smooth height animation (CSS grid-template-rows 0fr -> 1fr,
// see settingsLayout.css) instead of an instant show/hide, real
// glassmorphism, and real hover feedback.
//
// Deliberately module-scope (not defined inside SettingsPage's own
// render) for the same real reason its predecessor already was: a
// component redefined on every parent render is a brand-new type to
// React every time, which fully unmounts and remounts every instance
// (losing each card's own open/closed state) instead of just
// re-rendering - not a re-render performance nitpick, an actual
// correctness bug.
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const SettingCard = ({ icon: Icon, title, subtitle, defaultOpen = false, children, tourId, forceOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    // Real, requested gap: a replayed tour (see the new "Replay App
    // Tours" button) can spotlight a card the user has since manually
    // collapsed - the tour's own scroll/position math still works, but
    // there'd be nothing visible inside to point at. forceOpen only ever
    // raises a floor on top of the user's own toggle - it never fights a
    // manual collapse once the tour moves past this step (isOpen itself
    // is untouched either way).
    const open = isOpen || forceOpen;

    return (
        <div className="setting-card" data-tour-id={tourId}>
            <button
                type="button"
                className="setting-card-header"
                onClick={() => setIsOpen((v) => !v)}
                aria-expanded={open}
            >
                <div className="setting-card-header-left">
                    <div className="setting-card-icon">
                        <Icon size={18} color="var(--accent)" />
                    </div>
                    <div className="setting-card-title-group">
                        <h2 className="setting-card-title">{title}</h2>
                        {subtitle && <span className="setting-card-subtitle">{subtitle}</span>}
                    </div>
                </div>
                <ChevronDown size={20} className={`setting-card-chevron${open ? ' is-open' : ''}`} />
            </button>

            <div className={`setting-card-body${open ? ' is-open' : ''}`}>
                <div className="setting-card-body-inner">
                    <div className="setting-card-body-content">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingCard;
