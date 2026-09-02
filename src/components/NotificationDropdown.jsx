// src/components/NotificationDropdown.jsx
//
// Point 11: the Notification Center's presentation layer - real data
// comes from useNotifications.js (severe weather, upcoming Calendar
// events, overdue/due-soon Finance bills, overdue Planner tasks). Always
// mounted (visibility driven by the `is-open` class, not conditional
// JSX) so both the entrance AND exit transitions defined in
// notifications.css actually get to play, matching the same pattern
// MobileSidebarDrawer.jsx already uses for its own backdrop+panel.
import { AlertTriangle, X, CheckCheck, Trash2 } from 'lucide-react';
import { formatRelativeTime } from '../hooks/useNotifications.js';

const NotificationDropdown = ({ isOpen, onClose, notifications, unreadCount, onMarkRead, onMarkAllRead, onClearAll, setActiveTab }) => {
    const handleItemClick = (item) => {
        onMarkRead(item.id);
        onClose();
        if (item.targetTab && typeof setActiveTab === 'function') setActiveTab(item.targetTab);
    };

    return (
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
        </>
    );
};

export default NotificationDropdown;
