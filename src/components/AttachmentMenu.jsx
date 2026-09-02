// src/components/AttachmentMenu.jsx
//
// A globally reusable "add an attachment" menu - Camera / Photo / Files.
// Styled from a real, confirmed side-by-side comparison against ChatGPT's
// own mobile app: its "+" menu is a small, rounded-on-every-corner card
// that floats just above the input bar (anchored near the button that
// opened it, with visible space around it), not a heavy, edge-to-edge,
// dark-backdrop bottom sheet - no grabber handle, no separate "Cancel"
// row either (tapping anywhere outside just dismisses it). This is
// deliberately the SAME anchored-popover shape this app's own desktop
// attach menu already uses (position: absolute, anchored to the trigger
// button), just sized and spaced for a touch target instead of a mouse -
// one visual language for both, matching the reference instead of
// inventing a second, heavier mobile-only sheet design.
//
// Generic and reusable: doesn't know or care what the caller does with a
// picked file, it just hands one back via onFileSelected(file, kind) or
// asks the caller to open a camera via onCamera() (a separate reusable
// component, CameraCapture.jsx - this menu never touches the camera
// directly). Drop this into any screen that needs "pick an image from
// somewhere" - AI chat attachments today, a profile picture, a diet meal
// log photo, a receipt upload, etc.
import { useEffect, useRef } from 'react';
import { Camera as CameraIcon, Image as ImageIcon, Paperclip } from 'lucide-react';

const AttachmentMenu = ({
    isOpen, onClose, onCamera, onFileSelected,
    allowFiles = true, allowFilesHint = '',
    filesAccept = 'image/*,.pdf,application/pdf',
    style,
    // Camera only makes sense where there's an actual device camera to
    // launch - a real, reported complaint showed this "Camera" row
    // rendered (and was tapped, and did nothing useful) on a plain
    // desktop browser. Callers pass this from their own useIsMobile()
    // check; defaults to true so nothing else using this menu regresses.
    showCamera = true,
    // Optional: the ref of whatever button opens this menu. Without this,
    // clicking that same button again to CLOSE the menu would trigger
    // this component's own outside-click handler first (mousedown fires
    // before click), which closes it - and then the button's own onClick
    // toggle handler fires right after and flips it straight back open,
    // a real, confirmed bug where the "+" button appeared to do nothing
    // on a second tap. Excluding the trigger from the outside-click check
    // is what actually fixes that, not the mousedown-vs-click timing
    // alone.
    triggerRef,
}) => {
    const menuRef = useRef(null);
    const photoInputRef = useRef(null);
    const filesInputRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return undefined;
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        const handleOutsideClick = (e) => {
            if (menuRef.current?.contains(e.target)) return;
            if (triggerRef?.current?.contains(e.target)) return;
            onClose();
        };
        document.addEventListener('keydown', handleKey);
        document.addEventListener('mousedown', handleOutsideClick);
        return () => {
            document.removeEventListener('keydown', handleKey);
            document.removeEventListener('mousedown', handleOutsideClick);
        };
    }, [isOpen, onClose, triggerRef]);

    if (!isOpen) return null;

    const handlePhotoChange = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        onClose();
        if (file) onFileSelected(file, 'photo');
    };

    const handleFilesChange = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        onClose();
        if (file) onFileSelected(file, 'file');
    };

    return (
        <div ref={menuRef} className="nexus-attach-menu" style={style}>
            {showCamera && (
                <button
                    type="button" className="nexus-attach-menu-item"
                    disabled={!allowFiles}
                    onClick={() => { onClose(); onCamera(); }}
                >
                    <span className="nexus-attach-menu-item-icon"><CameraIcon size={18} /></span>
                    <span>
                        Camera
                        {!allowFiles && allowFilesHint && <span className="nexus-attach-menu-item-hint">{allowFilesHint}</span>}
                    </span>
                </button>
            )}
            <button
                type="button" className="nexus-attach-menu-item"
                disabled={!allowFiles}
                onClick={() => photoInputRef.current?.click()}
            >
                <span className="nexus-attach-menu-item-icon"><ImageIcon size={18} /></span>
                <span>
                    Photo
                    {!allowFiles && allowFilesHint && <span className="nexus-attach-menu-item-hint">{allowFilesHint}</span>}
                </span>
            </button>
            <button
                type="button" className="nexus-attach-menu-item"
                disabled={!allowFiles}
                onClick={() => filesInputRef.current?.click()}
            >
                <span className="nexus-attach-menu-item-icon"><Paperclip size={18} /></span>
                <span>
                    Files
                    {!allowFiles && allowFilesHint && <span className="nexus-attach-menu-item-hint">{allowFilesHint}</span>}
                </span>
            </button>

            <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
            <input ref={filesInputRef} type="file" accept={filesAccept} style={{ display: 'none' }} onChange={handleFilesChange} />
        </div>
    );
};

export default AttachmentMenu;
