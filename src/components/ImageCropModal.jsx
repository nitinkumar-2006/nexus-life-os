// src/components/ImageCropModal.jsx
//
// A self-contained crop/reposition/zoom modal. No external cropping library
// is used - this is plain React + a <canvas> export step, so it works with
// zero new dependencies. Supports a circular crop frame (avatars) or a wide
// rectangular one (cover banners) via the `shape` prop.
import { useRef, useState, useCallback } from 'react';
import { X, ZoomIn, Check, Move } from 'lucide-react';

const ImageCropModal = ({ imageSrc, shape = 'circle', onSave, onCancel }) => {
    const previewSize = shape === 'circle' ? { width: 280, height: 280 } : { width: 560, height: 200 };
    // Downsized from the original 400x400 / 1200x428 - both this avatar
    // and the cover banner get base64-embedded directly into
    // nexus_user_profile, which CloudSyncContext.jsx bundles alongside
    // every other module's data into ONE Firestore document capped at
    // 1MB. A full-size avatar+cover pair could alone run several hundred
    // KB, leaving too little headroom for a real user's actual Planner/
    // Finance/Gym/Study history once synced - a genuine, confirmed cause
    // of "I restored on a new device but my settings/theme never came
    // back" (the whole merged write fails atomically past the 1MB cap,
    // so nothing in that push lands, not just the oversized field).
    // These dimensions still comfortably exceed every real on-screen use
    // (a 112px avatar, a 160px cover banner) at 2x+ pixel density, so
    // this is a real size reduction with no visible quality loss for how
    // either image actually gets displayed.
    const exportSize = shape === 'circle' ? { width: 320, height: 320 } : { width: 900, height: 322 };

    const imgRef = useRef(null);
    const containerRef = useRef(null);
    const [naturalSize, setNaturalSize] = useState(null);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const dragState = useRef(null);

    const handleImageLoad = () => {
        if (imgRef.current) {
            setNaturalSize({ width: imgRef.current.naturalWidth, height: imgRef.current.naturalHeight });
        }
    };

    const baseScale = naturalSize
        ? Math.max(previewSize.width / naturalSize.width, previewSize.height / naturalSize.height)
        : 1;

    const startDrag = (clientX, clientY) => {
        dragState.current = { startX: clientX, startY: clientY, startOffset: offset };
    };

    const moveDrag = (clientX, clientY) => {
        if (!dragState.current) return;
        const dx = clientX - dragState.current.startX;
        const dy = clientY - dragState.current.startY;
        setOffset({ x: dragState.current.startOffset.x + dx, y: dragState.current.startOffset.y + dy });
    };

    const endDrag = () => {
        dragState.current = null;
    };

    const handleMouseDown = (e) => startDrag(e.clientX, e.clientY);
    const handleMouseMove = (e) => moveDrag(e.clientX, e.clientY);
    const handleTouchStart = (e) => {
        const t = e.touches[0];
        startDrag(t.clientX, t.clientY);
    };
    const handleTouchMove = (e) => {
        const t = e.touches[0];
        moveDrag(t.clientX, t.clientY);
    };

    const handleSave = useCallback(() => {
        if (!naturalSize || !imgRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = exportSize.width;
        canvas.height = exportSize.height;
        const ctx = canvas.getContext('2d');
        const exportScale = exportSize.width / previewSize.width;

        ctx.save();
        if (shape === 'circle') {
            ctx.beginPath();
            ctx.arc(exportSize.width / 2, exportSize.height / 2, exportSize.width / 2, 0, Math.PI * 2);
            ctx.clip();
        }

        const drawWidth = naturalSize.width * baseScale * scale * exportScale;
        const drawHeight = naturalSize.height * baseScale * scale * exportScale;
        const drawX = exportSize.width / 2 - drawWidth / 2 + offset.x * exportScale;
        const drawY = exportSize.height / 2 - drawHeight / 2 + offset.y * exportScale;

        ctx.drawImage(imgRef.current, drawX, drawY, drawWidth, drawHeight);
        ctx.restore();

        // PNG for circular avatars - JPEG has no alpha channel, so the area
        // outside the circular clip (never painted) was baking in as solid
        // black instead of staying transparent. Cover banners are fully
        // rectangular with no transparency need, so they stay JPEG for a
        // smaller file size.
        const mimeType = shape === 'circle' ? 'image/png' : 'image/jpeg';
        // 0.85, not 0.92 - matches the same quality this codebase already
        // settled on for the other user-uploaded-photo path (Settings'
        // own custom wallpaper upload, see SettingsPage.jsx's
        // handleCustomImageFile), and meaningfully shrinks the payload
        // for the same 1MB Firestore document budget this shares with
        // every other synced module - not visually distinguishable from
        // 0.92 at this file's actual display sizes.
        onSave(canvas.toDataURL(mimeType, shape === 'circle' ? undefined : 0.85));
    }, [naturalSize, baseScale, scale, offset, shape, onSave, exportSize, previewSize]);

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
            }}
            onMouseUp={endDrag}
            onMouseLeave={endDrag}
            onMouseMove={handleMouseMove}
            onTouchEnd={endDrag}
            onTouchMove={handleTouchMove}
        >
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', width: 'fit-content', boxShadow: '0 25px 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '18px', alignItems: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Move size={16} /> {shape === 'circle' ? 'Adjust Avatar' : 'Adjust Cover Banner'}
                    </h3>
                    <button onClick={onCancel} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
                </div>

                <div
                    ref={containerRef}
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                    style={{
                        width: `${previewSize.width}px`, height: `${previewSize.height}px`,
                        borderRadius: shape === 'circle' ? '50%' : '16px',
                        overflow: 'hidden', position: 'relative', background: '#000',
                        cursor: 'grab', border: '2px solid rgba(255,255,255,0.15)',
                        touchAction: 'none', userSelect: 'none',
                    }}
                >
                    <img
                        ref={imgRef}
                        src={imageSrc}
                        onLoad={handleImageLoad}
                        alt="Crop preview"
                        draggable={false}
                        style={{
                            position: 'absolute', top: '50%', left: '50%',
                            width: naturalSize ? `${naturalSize.width * baseScale * scale}px` : 'auto',
                            height: naturalSize ? `${naturalSize.height * baseScale * scale}px` : 'auto',
                            transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
                            pointerEvents: 'none',
                        }}
                    />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                    <ZoomIn size={16} color="#94A3B8" />
                    <input
                        type="range" min="1" max="3" step="0.01" value={scale}
                        onChange={(e) => setScale(parseFloat(e.target.value))}
                        aria-label="Zoom"
                        style={{ flex: 1, accentColor: '#6366F1' }}
                    />
                </div>
                <p style={{ fontSize: '11px', color: '#64748B', margin: 0, textAlign: 'center' }}>Drag to reposition &bull; use the slider to zoom</p>

                <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                    <button onClick={onCancel} style={{ flex: 1, padding: '11px', background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleSave} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '11px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}><Check size={15} /> Save</button>
                </div>
            </div>
        </div>
    );
};

export default ImageCropModal;
