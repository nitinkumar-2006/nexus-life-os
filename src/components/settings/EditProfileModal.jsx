// src/components/settings/EditProfileModal.jsx
//
// A real floating overlay for editing the Name/Avatar shown on
// Settings' own profile header card - deliberately scoped to just
// those two fields (not a re-implementation of ProfilePage.jsx's own
// much larger in-place edit form for bio/socials/skills/etc). Saves
// through the same 'nexus_user_profile' localStorage key and
// 'nexus_profile_updated' event ProfilePage.jsx already uses, so
// editing from either place stays in sync everywhere (Header,
// GreetingCard, this card, the full Profile page).
//
// Identity (email/phone/local-only) is shown but never editable here -
// it's the real sign-in identity, not a cosmetic profile field; a
// generic text input isn't how you safely change a Firebase auth
// email (reauth + verification, not in scope here).
//
// Rendered through a portal into document.body, not inline where this
// is used (SettingsProfileHeader.jsx) - that component's own root,
// .settings-profile-header, sets backdrop-filter on itself, and
// backdrop-filter creates a new containing block for `position: fixed`
// descendants exactly like `transform` does. Without the portal, this
// modal's own `position: fixed; inset: 0` resolved against that
// card's own small box instead of the real viewport (confirmed live:
// getBoundingClientRect() came back roughly the card's own size/
// position, not 0,0 - full width/height) - the classic "modal trapped
// inside a filtered/transformed ancestor" bug, just triggered by
// backdrop-filter specifically rather than the more commonly-known
// transform case.
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera, User as UserIcon } from 'lucide-react';
import ImageCropModal from '../ImageCropModal.jsx';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock.js';

const CLOSE_ANIMATION_MS = 180;

const EditProfileModal = ({ isOpen, onClose, initialName, initialAvatarUrl, identity, onSave }) => {
    const [name, setName] = useState(initialName || '');
    const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl || '');
    const [cropSrc, setCropSrc] = useState(null);
    const [isClosing, setIsClosing] = useState(false);
    const fileInputRef = useRef(null);

    // Re-seed the draft from the latest saved values every time the
    // modal is (re)opened - without this, closing without saving once
    // and reopening later would show stale in-progress edits instead
    // of what's actually persisted.
    useEffect(() => {
        if (isOpen) {
            setName(initialName || '');
            setAvatarUrl(initialAvatarUrl || '');
            setIsClosing(false);
        }
    }, [isOpen, initialName, initialAvatarUrl]);

    useBodyScrollLock(isOpen);

    useEffect(() => {
        if (!isOpen) return undefined;
        const onKeyDown = (e) => { if (e.key === 'Escape') handleClose(); };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    if (!isOpen && !isClosing) return null;

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            setIsClosing(false);
            onClose();
        }, CLOSE_ANIMATION_MS);
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setCropSrc(reader.result);
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };

    const handleCropSave = (croppedDataUrl) => {
        setAvatarUrl(croppedDataUrl);
        setCropSrc(null);
    };

    const handleSave = () => {
        onSave({ name: name.trim(), avatarUrl });
        handleClose();
    };

    const avatarInitial = name ? name.charAt(0).toUpperCase() : '';

    return createPortal(
        <>
            <div
                className={`edit-profile-backdrop${isClosing ? ' is-closing' : ''}`}
                onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
            >
                {/* Motion (transform) and glass (backdrop-filter) are
                    deliberately split across two nested elements - see
                    editProfileModal.css's own comment on
                    .edit-profile-card-motion for why combining both on
                    one element left this modal's own text rendering
                    visibly soft even at rest, not just mid-animation. */}
                <div className="edit-profile-card-motion">
                <div className="edit-profile-card" role="dialog" aria-modal="true" aria-label="Edit Profile">
                    <div className="edit-profile-header">
                        <div>
                            <h3 className="edit-profile-title">Edit Profile</h3>
                            <p className="edit-profile-subtitle">Update your name and avatar</p>
                        </div>
                        <button type="button" className="edit-profile-close-btn" onClick={handleClose} aria-label="Close">
                            <X size={16} />
                        </button>
                    </div>

                    <div className="edit-profile-avatar-row">
                        <button type="button" className="edit-profile-avatar-btn" onClick={() => fileInputRef.current?.click()} aria-label="Change avatar" title="Change avatar">
                            {avatarUrl ? <img src={avatarUrl} alt="" /> : (avatarInitial || <UserIcon size={26} />)}
                            <span className="edit-profile-avatar-badge"><Camera size={12} /></span>
                        </button>
                        <div className="edit-profile-avatar-actions">
                            <span className="edit-profile-avatar-hint">JPG or PNG, cropped to a circle</span>
                            {avatarUrl && (
                                <button type="button" className="edit-profile-remove-avatar" onClick={() => setAvatarUrl('')}>
                                    Remove photo
                                </button>
                            )}
                        </div>
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                    </div>

                    <div className="edit-profile-field">
                        <label className="edit-profile-label" htmlFor="edit-profile-name">Name</label>
                        <input
                            id="edit-profile-name"
                            className="edit-profile-input"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your name"
                            maxLength={60}
                            autoFocus
                        />
                    </div>

                    <div className="edit-profile-field">
                        <span className="edit-profile-label">Email</span>
                        <div className="edit-profile-static-value">{identity}</div>
                    </div>

                    <div className="edit-profile-actions">
                        <button type="button" className="edit-profile-btn edit-profile-btn-cancel" onClick={handleClose}>Cancel</button>
                        <button type="button" className="edit-profile-btn edit-profile-btn-save" onClick={handleSave} disabled={!name.trim()}>Save Changes</button>
                    </div>
                </div>
                </div>
            </div>
            {cropSrc && (
                <ImageCropModal imageSrc={cropSrc} shape="circle" onSave={handleCropSave} onCancel={() => setCropSrc(null)} />
            )}
        </>,
        document.body
    );
};

export default EditProfileModal;
