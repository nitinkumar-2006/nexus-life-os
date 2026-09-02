// src/components/settings/SettingsNav.jsx
//
// The fixed, glassmorphic left-column category list for the redesigned
// Settings Hub. Purely presentational - categories and the active
// selection are owned by SettingsPage.jsx and passed down.
const SettingsNav = ({ categories, activeCategory, onSelectCategory }) => (
    <nav className="settings-nav" aria-label="Settings categories">
        {categories.map((cat) => {
            const CatIcon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
                <button
                    key={cat.id}
                    type="button"
                    className={`settings-nav-item${isActive ? ' is-active' : ''}`}
                    onClick={() => onSelectCategory(cat.id)}
                    aria-current={isActive ? 'page' : undefined}
                >
                    <span className="settings-nav-item-icon"><CatIcon size={17} /></span>
                    <span className="settings-nav-item-label">{cat.label}</span>
                </button>
            );
        })}
    </nav>
);

export default SettingsNav;
