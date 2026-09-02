// src/components/audio/EqualizerBars.jsx
//
// A small animated equalizer - bars only animate while isPlaying is
// genuinely true (paused via CSS animation-play-state, not remounted),
// so it starts/stops in exact sync with actual playback rather than
// looping regardless of state. Extracted out of AudioHubPage.jsx (unchanged)
// so other new Audio Hub pieces (QueueManager, FloatingBottomPlayer) can
// use it without importing the whole page file.
import React from 'react';

const EqualizerBars = React.memo(({ isPlaying, size = 'normal' }) => {
    const barCount = 4;
    const heightPx = size === 'small' ? 14 : 20;
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2.5px', height: `${heightPx}px` }}>
            {Array.from({ length: barCount }, (_, i) => (
                <div
                    key={i}
                    style={{
                        width: '3px', borderRadius: '2px', background: 'var(--primary)',
                        height: '100%',
                        animation: `nexusEqBar${i % 3} ${0.7 + i * 0.15}s ease-in-out infinite`,
                        animationPlayState: isPlaying ? 'running' : 'paused',
                        opacity: isPlaying ? 1 : 0.35,
                        transformOrigin: 'bottom',
                    }}
                />
            ))}
            <style>{`
                @keyframes nexusEqBar0 { 0%, 100% { transform: scaleY(0.3); } 50% { transform: scaleY(1); } }
                @keyframes nexusEqBar1 { 0%, 100% { transform: scaleY(0.9); } 50% { transform: scaleY(0.25); } }
                @keyframes nexusEqBar2 { 0%, 100% { transform: scaleY(0.5); } 50% { transform: scaleY(1); } }
            `}</style>
        </div>
    );
});

export default EqualizerBars;
