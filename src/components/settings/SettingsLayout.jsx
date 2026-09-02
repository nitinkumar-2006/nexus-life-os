// src/components/settings/SettingsLayout.jsx
//
// The split-pane shell: SettingsNav (left) + SettingsContent (right).
// Owns only the real, local, presentational concern of "is the mobile
// full-screen content overlay open" - which category is actually
// active is controlled state from SettingsPage.jsx (passed down),
// since that's what gates which real settings content even renders.
import { useState, useEffect } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock.js';
import SettingsNav from './SettingsNav.jsx';
import SettingsContent from './SettingsContent.jsx';

const SettingsLayout = ({ categories, activeCategory, onSelectCategory, header, children, onMobileOverlayChange }) => {
    const isMobile = useIsMobile();
    const [isMobileContentOpen, setIsMobileContentOpen] = useState(false);

    // Real fix for "background scrolls underneath the active view" (and
    // the related "flashes solid white/black" - iOS Safari's genuine
    // rubber-band overscroll revealing whatever's past the edge of a
    // still-scrollable page behind a `position: fixed` overlay). The
    // overlay itself was already correctly pinned; the real page behind
    // it was never actually prevented from scrolling.
    useBodyScrollLock(isMobile && isMobileContentOpen);

    // Reports this overlay's open state up to DashboardLayout, which
    // uses it to genuinely unmount the real global header while this
    // is open (see DashboardLayout.jsx's isHeaderHiddenOnMobile) - the
    // one piece of "what's behind this overlay" that can't be hidden
    // from inside Settings itself, since it's mounted above SettingsPage.
    useEffect(() => {
        onMobileOverlayChange?.(isMobile && isMobileContentOpen);
        return () => onMobileOverlayChange?.(false);
    }, [isMobile, isMobileContentOpen, onMobileOverlayChange]);

    const handleSelect = (id) => {
        onSelectCategory(id);
        if (isMobile) setIsMobileContentOpen(true);
    };

    const activeCategoryMeta = categories.find((c) => c.id === activeCategory);

    // Real DOM-level hiding, not another translucency tweak: a screen
    // recording confirmed that even a forced-opaque overlay background
    // still let bold nav-label text ghost through legibly - a
    // backdrop-filter blur softens a letter's edges but doesn't erase
    // the luminance spike it leaves in the blurred backdrop, so
    // compositing ANY alpha-below-1 background over it still shows a
    // faint, readable shape. The title/profile header/nav
    // column genuinely unmount here while the mobile overlay is open,
    // so there is nothing behind the overlay left to bleed through.
    const showNavColumn = !isMobile || !isMobileContentOpen;

    return (
        <>
            {showNavColumn && header}
            <div className="settings-split">
                {showNavColumn && (
                    <SettingsNav categories={categories} activeCategory={activeCategory} onSelectCategory={handleSelect} />
                )}
                <SettingsContent
                    activeCategory={activeCategory}
                    isMobile={isMobile}
                    isOpen={isMobile ? isMobileContentOpen : true}
                    onBack={() => setIsMobileContentOpen(false)}
                    categoryLabel={activeCategoryMeta?.label}
                >
                    {children}
                </SettingsContent>
            </div>
        </>
    );
};

export default SettingsLayout;
