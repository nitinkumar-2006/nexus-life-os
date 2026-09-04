// src/components/NotificationDropdown.jsx
//
// Point 11: the Notification Center's presentation layer - real data
// comes from useNotifications.js (severe weather, upcoming Calendar
// events, overdue/due-soon Finance bills, overdue Planner tasks). Always
// mounted (visibility driven by the `is-open` class, not conditional
// JSX) so both the entrance AND exit transitions defined in
// notifications.css actually get to play, matching the same pattern
// MobileSidebarDrawer.jsx already uses for its own backdrop+panel.
//
// Rendered via a real portal straight to document.body now - a real,
// confirmed bug: this used to render inline inside header.jsx's own
// component tree, a DESCENDANT of the header element. On the Dynamic
// theme, that header gets a real backdrop-filter applied to it (see
// style.css's own [data-theme="dynamic"] [style*="var(--header-bg"]
// rule) - and per the CSS spec, an ancestor with backdrop-filter (same
// as transform/filter/will-change:transform) becomes the CONTAINING
// BLOCK for any position:fixed descendant, instead of the viewport.
// This mobile panel is position:fixed (a bottom sheet - see
// notifications.css's own mobile media query), so its `bottom: 0`
// was resolving against the header's own ~60px box instead of the
// real screen, which is exactly the "notification goes way above,
// nowhere near where it should open" reported live. A portal to
// document.body is the same, already-proven fix QuickNotesModal.jsx
// uses for the identical class of bug (see that file's own comment) -
// it can never be trapped inside ANY ancestor's stacking/containing-
// block context this way, regardless of theme. header.jsx's own
// outside-click handler now checks for `.nexus-notif-panel` directly
// (via e.target.closest) instead of ref-containment, since this panel's
// DOM nodes are no longer inside that ref's subtree.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X, CheckCheck, Trash2 } from 'lucide-react';
import { formatRelativeTime } from '../hooks/useNotifications.js';
import { useIsMobile } from '../hooks/useIsMobile.js';

// anchorRef: header.jsx's own notifRef (the bell button's wrapper) -
// desktop measures its real screen position to anchor this panel exactly
// below/right-aligned to the button (position:absolute's own old "top:
// calc(100% + 12px); right: 0" only worked when this rendered as an
// actual DOM descendant of that button; now that it's portaled straight
// to document.body, position:absolute has no positioned ancestor to
// anchor to at all and would place it at the page's own top-right
// instead). Mobile ignores this entirely - notifications.css's own
// media query already turns this into a fixed bottom sheet that needs
// no anchor measurement, so anchorRef can safely be omitted there.
const NotificationDropdown = ({ isOpen, onClose, notifications, unreadCount, onMarkRead, onMarkAllRead, onClearAll, setActiveTab, anchorRef }) => {
    const isMobile = useIsMobile();
    const [anchorStyle, setAnchorStyle] = useState(null);

    useEffect(() => {
        if (isMobile || !isOpen || !anchorRef?.current) return undefined;
        const measure = () => {
            const rect = anchorRef.current.getBoundingClientRect();
            setAnchorStyle({
                position: 'fixed',
                top: `${rect.bottom + 12}px`,
                right: `${window.innerWidth - rect.right}px`,
            });
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [isMobile, isOpen, anchorRef]);

    const handleItemClick = (item) => {
        onMarkRead(item.id);
        onClose();
        if (item.targetTab && typeof setActiveTab === 'function') setActiveTab(item.targetTab);
    };

    return createPortal(
        <>
            <div
                className={`nexus-notif-backdrop${isOpen ? ' is-open' : ''}`}
                onClick={onClose}
                aria-hidden="true"
            />
            <div
                className={`nexus-notif-panel${isOpen ? ' is-open' : ''}`}
                role="dialog"
                aria-label="Notifications"
                aria-hidden={!isOpen}
                style={!isMobile && anchorStyle ? anchorStyle : undefined}
            >
                <div className="nexus-notif-header">
                    <div className="nexus-notif-header-title">
                        <h4>Notifications</h4>
                        {unreadCount > 0 && <span className="nexus-notif-count-badge">{unreadCount}</span>}
                    </div>
                    {notifications.length > 0 && (
                        <div className="nexus-notif-header-actions">
                            <button type="button" onClick={onMarkAllRead} title="Mark all as read">
                                <CheckCheck size={14} /> Mark all read
                            </button>
                            <button type="button" onClick={onClearAll} title="Clear all">
                                <Trash2 size={14} /> Clear all
                            </button>
                        </div>
                    )}
                    <button type="button" className="nexus-notif-close-mobile" onClick={onClose} aria-label="Close notifications">
                        <X size={16} />
                    </button>
                </div>

                <div className="nexus-notif-list">
                    {notifications.length === 0 ? (
                        <div className="nexus-notif-empty">
                            <CheckCheck size={28} />
                            <p>All caught up!</p>
                            <span>No new notifications right now.</span>
                        </div>
                    ) : (
                        notifications.map((item) => {
                            const Icon = item.icon || AlertTriangle;
                            return (
                                <button
                                    type="button"
                                    key={item.id}
                                    className={`nexus-notif-item${item.read ? ' is-read' : ''}`}
                                    onClick={() => handleItemClick(item)}
                                >
                                    <span className="nexus-notif-item-icon" style={{ color: item.accent }}>
                                        <Icon size={16} />
                                    </span>
                                    <span className="nexus-notif-item-body">
                                        <span className="nexus-notif-item-top">
                                            <span className="nexus-notif-item-title">{item.title}</span>
                                            <span className="nexus-notif-item-time">{formatRelativeTime(item.timestamp)}</span>
                                        </span>
                                        <span className="nexus-notif-item-desc">{item.description}</span>
                                        <span className="nexus-notif-item-category">{item.category}</span>
                                    </span>
                                    {!item.read && <span className="nexus-notif-item-dot" aria-hidden="true" />}
                                </button>
                            );
                        })
                    )}
                </div>
            </div>
        </>,
        document.body
    );
};

export default NotificationDropdown;
