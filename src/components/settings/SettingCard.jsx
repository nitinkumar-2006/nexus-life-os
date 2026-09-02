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

const SettingCard = ({ icon: Icon, title, subtitle, defaultOpen = false, children, tourId }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="setting-card" data-tour-id={tourId}>
            <button
                type="button"
                className="setting-card-header"
                onClick={() => setIsOpen((v) => !v)}
                aria-expanded={isOpen}
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
                <ChevronDown size={20} className={`setting-card-chevron${isOpen ? ' is-open' : ''}`} />
            </button>

            <div className={`setting-card-body${isOpen ? ' is-open' : ''}`}>
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
