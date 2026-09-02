// src/components/settings/SettingsContent.jsx
//
// The dynamic right pane. Its real actual content (every SettingCard,
// with all of its real state/handlers) stays defined in
// SettingsPage.jsx as children, conditionally rendered there based on
// which category is active - relocating 2000+ lines of tightly-coupled
// settings logic into this file would mean threading dozens of props
// across a new boundary for zero real benefit, exactly the kind of
// premature file-splitting this app's own conventions avoid elsewhere.
// What THIS component genuinely owns is the real, generic mechanics of
// "a dynamic content viewport": the key={activeCategory} below is what
// makes the fade+slide-up entrance (settings-content-page's own
// keyframe, see settingsLayout.css) actually replay on every switch -
// a plain class toggle on an already-mounted node would not restart a
// CSS `animation` the same way a real remount does - and the mobile
// full-screen-overlay chrome (back button, slide transform).
import { ChevronLeft } from 'lucide-react';

const SettingsContent = ({ activeCategory, children, isMobile, isOpen, onBack, categoryLabel }) => (
    <div className={`settings-content${isMobile && isOpen ? ' is-visible' : ''}`}>
        {isMobile && (
            <button type="button" className="settings-content-back-btn" onClick={onBack}>
                <ChevronLeft size={18} /> {categoryLabel}
            </button>
        )}
        <div key={activeCategory} className="settings-content-page">
            {children}
        </div>
    </div>
);

export default SettingsContent;
