// src/components/ProfileImageEditModal.jsx
//
// Opened by tapping the avatar or cover banner directly on the Profile
// page. Offers a built-in gallery of default presets (instant apply, no
// crop needed - they're already generated at the right aspect ratio) plus
// an "Upload from Device" entry point that hands off to the existing,
// already-working ImageCropModal flow rather than duplicating it.
import { X, Upload, Check } from 'lucide-react';
import { AVATAR_PRESETS, COVER_PRESETS } from '../utils/profileImagePresets.js';

const ProfileImageEditModal = ({ type, currentUrl, onSelectPreset, onUploadChange, onClose }) => {
    const isAvatar = type === 'avatarUrl';
    const presets = isAvatar ? AVATAR_PRESETS : COVER_PRESETS;

    return (
        <div
            style={{ position: 'fixed', inset: 0, zIndex: 2900, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', padding: '20px', boxSizing: 'border-box' }}
            onClick={onClose}
        >
            <div
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', width: '100%', maxWidth: '480px', maxHeight: '82vh', display: 'flex', flexDirection: 'column', gap: '18px', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>{isAvatar ? 'Change Avatar' : 'Change Cover Banner'}</h3>
                    <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}><X size={20} /></button>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', borderRadius: '14px', border: '1.5px dashed var(--border-premium)', color: 'var(--accent)', fontSize: '13px', fontWeight: '700', cursor: 'pointer', background: 'var(--surface-inset)' }}>
                    <Upload size={16} /> Upload from Device
                    <input type="file" accept="image/*" onChange={onUploadChange} style={{ display: 'none' }} />
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Default Presets</p>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: isAvatar ? 'repeat(auto-fill, minmax(72px, 1fr))' : 'repeat(auto-fill, minmax(140px, 1fr))',
                        gap: '12px', overflowY: 'auto', paddingRight: '4px',
                    }}>
                        {presets.map((preset) => {
                            const isSelected = currentUrl === preset.dataUrl;
                            return (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => onSelectPreset(preset.dataUrl)}
                                    aria-label={preset.label}
                                    aria-pressed={isSelected}
                                    title={preset.label}
                                    style={{
                                        position: 'relative', padding: 0, border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border-premium)',
                                        borderRadius: isAvatar ? '50%' : '10px', overflow: 'hidden', cursor: 'pointer',
                                        aspectRatio: isAvatar ? '1 / 1' : '1200 / 428', background: 'var(--surface-inset)',
                                    }}
                                >
                                    <img src={preset.dataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                    {isSelected && (
                                        <span style={{ position: 'absolute', top: '4px', right: '4px', width: '18px', height: '18px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Check size={12} color="#fff" />
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileImageEditModal;
