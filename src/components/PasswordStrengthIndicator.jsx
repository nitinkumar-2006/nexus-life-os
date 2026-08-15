// src/components/PasswordStrengthIndicator.jsx
//
// A real, shared password-strength meter - a 5-point scoring algorithm
// (length >= 8, length >= 12, mixed case, a digit, a symbol) mapped to
// 4 honest labels with a real visual bar, not a decorative placeholder.
// Shared between LoginPage.jsx's own signup form and SettingsPage.jsx's
// own change-password form, so the same real logic and visual language
// is used everywhere a person sets a new password in this app, rather
// than two independently-drifting copies.

// Exported on its own so a caller can gate a submit button on genuine
// strength (e.g. "require at least Fair") without re-deriving the same
// scoring logic a second time.
export const getPasswordStrength = (password) => {
    if (!password) return { score: 0, label: '', color: 'transparent' };
    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;

    const levels = [
        { label: 'Very Weak', color: '#EF4444' },
        { label: 'Weak', color: '#EF4444' },
        { label: 'Fair', color: '#F59E0B' },
        { label: 'Good', color: '#3B82F6' },
        { label: 'Strong', color: '#10B981' },
        { label: 'Very Strong', color: '#10B981' },
    ];
    return { score, ...levels[score] };
};

// Renders nothing at all until the person has genuinely typed
// something - an empty meter for an empty field is just visual noise,
// not useful feedback.
const PasswordStrengthIndicator = ({ password }) => {
    const { score, label, color } = getPasswordStrength(password);
    if (!password) return null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
                {[0, 1, 2, 3, 4].map((i) => (
                    <div
                        key={i}
                        style={{
                            height: '4px', flex: 1, borderRadius: '2px',
                            background: i < score ? color : 'rgba(255,255,255,0.1)',
                            transition: 'background 0.2s ease',
                        }}
                    />
                ))}
            </div>
            <span style={{ fontSize: '11px', fontWeight: '700', color }}>{label}</span>
        </div>
    );
};

export default PasswordStrengthIndicator;
