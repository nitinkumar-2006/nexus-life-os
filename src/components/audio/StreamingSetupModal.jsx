// src/components/audio/StreamingSetupModal.jsx
//
// Extracted out of AudioHubPage.jsx (unchanged) so TransferMusicModal.jsx
// can open the exact same real setup-instructions modal for an
// unconfigured service, instead of a second copy.
import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { STREAMING_SETUP_INFO } from './streamingSetupInfo.js';

const StreamingSetupModal = ({ service, onClose }) => {
    const info = STREAMING_SETUP_INFO[service];
    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}
            onClick={onClose}
        >
            <div
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '24px', padding: '28px', width: '100%', maxWidth: '420px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '16px' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>{info.title}</h3>
                    <button onClick={onClose} title="Close" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex' }}>
                        <X size={18} />
                    </button>
                </div>
                <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {info.steps.map((step, i) => (
                        <li key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{step}</li>
                    ))}
                </ol>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Once saved, this button will connect for real - nothing else about the app needs to change.</span>
            </div>
        </div>
    );
};

export default StreamingSetupModal;
