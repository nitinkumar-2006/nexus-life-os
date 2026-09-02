// src/components/QuickNotesModal.jsx
//
// A self-contained Quick Notes system: section-based categorization (custom,
// user-named sections, each holding its own notes), full CRUD on both
// sections and notes, and a clean, distraction-free writing panel - all
// persisted to localStorage so notes survive reloads.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, FolderPlus, StickyNote, Check, Pencil, ArrowLeft, ChevronRight } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile.js';

const STORAGE_KEY = 'nexus_quick_notes';

const loadNotesData = () => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed.sections) && parsed.sections.length > 0) return parsed;
        }
    } catch (e) {
        /* fall through to default */
    }
    return { sections: [{ id: 'section-general', title: 'General', notes: [] }] };
};

const generateId = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

const DEFAULT_WIDTH = 860;
const DEFAULT_HEIGHT = 620;
const MIN_WIDTH = 520;
const MIN_HEIGHT = 400;
// A real, reported bug: the panel's own INITIAL size already adapts to a
// narrow viewport (Math.min(DEFAULT_WIDTH, window.innerWidth * 0.92)
// below), but resizing referenced the desktop-only MIN_WIDTH/MIN_HEIGHT
// constants above regardless of screen size - dragging a resize handle
// on a phone could force the panel BACK UP to 520px wide, wider than the
// phone's own viewport, undoing the very viewport-fit the initial size
// already got right. These floors are used by the resize handlers
// instead of the raw constants, so shrinking on a small screen actually
// works.
const effectiveMinWidth = () => Math.min(MIN_WIDTH, Math.round(window.innerWidth * 0.82));
const effectiveMinHeight = () => Math.min(MIN_HEIGHT, Math.round(window.innerHeight * 0.7));

// Edge/corner hit-areas for the floating window's resize system. Each entry
// is a CSS position (relative to the panel, which is the positioned
// ancestor) plus the resize cursor to show. 'n'/'s'/'e'/'w' resize one
// dimension only; the four corners resize both at once.
const RESIZE_HANDLES = [
    { dir: 'n', style: { top: -3, left: 10, right: 10, height: 7, cursor: 'ns-resize' } },
    { dir: 's', style: { bottom: -3, left: 10, right: 10, height: 7, cursor: 'ns-resize' } },
    { dir: 'w', style: { left: -3, top: 10, bottom: 10, width: 7, cursor: 'ew-resize' } },
    { dir: 'e', style: { right: -3, top: 10, bottom: 10, width: 7, cursor: 'ew-resize' } },
    { dir: 'nw', style: { top: -3, left: -3, width: 14, height: 14, cursor: 'nwse-resize' } },
    { dir: 'se', style: { bottom: -3, right: -3, width: 14, height: 14, cursor: 'nwse-resize' } },
    { dir: 'ne', style: { top: -3, right: -3, width: 14, height: 14, cursor: 'nesw-resize' } },
    { dir: 'sw', style: { bottom: -3, left: -3, width: 14, height: 14, cursor: 'nesw-resize' } },
];

// Replaces window.prompt with a real, custom text input dialog - autofocus,
// Enter to submit, Escape to cancel, and a disabled Save button until
// there's actually real, non-whitespace text to submit.
const TextPromptModal = ({ title, initialValue, onConfirm, onCancel }) => {
    const [value, setValue] = useState(initialValue || '');

    useEffect(() => {
        const handleEscape = (e) => { if (e.key === 'Escape') onCancel(); };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onCancel]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!value.trim()) return;
        onConfirm(value);
    };

    return (
        <div
            style={{ position: 'fixed', inset: 0, zIndex: 210000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={onCancel}
        >
            <form
                onSubmit={handleSubmit}
                onClick={(e) => e.stopPropagation()}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', width: '100%', maxWidth: '340px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
                <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>{title}</h3>
                <input
                    type="text" autoFocus value={value} onChange={(e) => setValue(e.target.value)}
                    aria-label={title}
                    style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" onClick={onCancel} style={{ flex: 1, padding: '10px', background: 'var(--widget-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-premium)', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                    <button
                        type="submit" disabled={!value.trim()}
                        style={{ flex: 1, padding: '10px', background: value.trim() ? 'var(--primary)' : 'var(--widget-bg)', color: value.trim() ? 'var(--text-on-primary)' : 'var(--text-muted)', border: value.trim() ? 'none' : '1px solid var(--border-premium)', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: value.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}
                    >
                        Save
                    </button>
                </div>
            </form>
        </div>
    );
};

// Replaces window.confirm with a real, custom confirmation dialog - the
// confirm button is styled destructively (red) since every current use of
// this is a deletion, making the consequence visually obvious rather than
// just text-implied.
const ConfirmModal = ({ message, onConfirm, onCancel }) => {
    useEffect(() => {
        const handleEscape = (e) => { if (e.key === 'Escape') onCancel(); };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onCancel]);

    return (
        <div
            style={{ position: 'fixed', inset: 0, zIndex: 210000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={onCancel}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '24px', width: '100%', maxWidth: '320px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
                <p style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>{message}</p>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" onClick={onCancel} style={{ flex: 1, padding: '10px', background: 'var(--widget-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-premium)', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                    <button type="button" onClick={onConfirm} style={{ flex: 1, padding: '10px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
                </div>
            </div>
        </div>
    );
};

const QuickNotesModal = ({ onClose, jumpTarget, onJumpConsumed }) => {
    const isMobile = useIsMobile();
    const [data, setData] = useState(loadNotesData);
    const [activeSectionId, setActiveSectionId] = useState(() => loadNotesData().sections[0]?.id);
    const [activeNoteId, setActiveNoteId] = useState(null);
    const [draftTitle, setDraftTitle] = useState('');
    const [draftContent, setDraftContent] = useState('');

    // Mobile-only drill-down navigation: 'sections' -> 'notes' -> 'note',
    // one full-width pane visible at a time (see the mobile-specific
    // render branch below). Desktop is completely unaffected - it still
    // shows all three columns side by side at once in its existing
    // floating window, this state is simply never read there. A real,
    // reported clutter complaint was that mobile used to reuse that exact
    // same simultaneous 3-column layout, just narrower, requiring a
    // sideways scroll to even reach the notes list or the writing panel -
    // nothing like how a real mobile notes app (Apple Notes, Keep) works.
    const [mobileView, setMobileView] = useState('sections');

    // Real deep-link from Spotlight Search (header.jsx) - opens directly
    // to the section/note the user actually searched for and clicked,
    // instead of always landing on whatever was last open. Only ever
    // runs once per jumpTarget (onJumpConsumed clears it in the parent),
    // so it doesn't keep fighting the user's own subsequent clicks.
    useEffect(() => {
        if (!jumpTarget) return;
        if (jumpTarget.sectionId) setActiveSectionId(jumpTarget.sectionId);
        if (jumpTarget.noteId) setActiveNoteId(jumpTarget.noteId);
        if (jumpTarget.noteId) setMobileView('note');
        else if (jumpTarget.sectionId) setMobileView('notes');
        onJumpConsumed?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jumpTarget]);

    // FLOATING WINDOW: fully custom drag (move) + resize (all 4 edges + all
    // 4 corners), replacing native CSS `resize: both` entirely. Native
    // resize had two real problems: (1) as a flex child of a parent using
    // alignItems/justifyContent: 'center', every resize tick re-centered
    // the box, fighting the cursor instead of tracking it, and (2) it gave
    // no way to also drag/reposition the window, and no control over
    // resize-from-the-top/left edges. Position and size are both plain
    // state now, updated only via these handlers - width/height and
    // top/left never fight each other, and dragging from the top or left
    // edge correctly keeps the OPPOSITE edge anchored (standard desktop-
    // window resize behavior), rather than the box appearing to teleport.
    // Clamped to the real viewport at mount - the previous hardcoded
    // DEFAULT_WIDTH/HEIGHT ignored window.innerWidth/innerHeight entirely,
    // so on a phone screen (this modal is now reachable there too - see
    // header.jsx) it opened far wider/taller than the viewport itself with
    // no way to see or reach most of it, since only a later manual RESIZE
    // drag ever applied this same maxWidth/maxHeight clamp.
    const [size, setSize] = useState(() => ({
        width: Math.min(DEFAULT_WIDTH, window.innerWidth * 0.92),
        height: Math.min(DEFAULT_HEIGHT, window.innerHeight * 0.86),
    }));
    const [position, setPosition] = useState(() => ({
        top: Math.max(16, (window.innerHeight - Math.min(DEFAULT_HEIGHT, window.innerHeight * 0.86)) / 2),
        left: Math.max(16, (window.innerWidth - Math.min(DEFAULT_WIDTH, window.innerWidth * 0.92)) / 2),
    }));
    const resizeRef = useRef(null);
    const dragRef = useRef(null);

    // Real, shared core for both mouse and touch resize - takes plain
    // clientX/clientY (mouse and touch events expose this differently:
    // e.clientX directly on a MouseEvent, e.touches[0].clientX on a
    // TouchEvent, so each entry point below extracts its own coordinate
    // and calls this one implementation, rather than a second, parallel
    // touch-specific copy of the resize math that could drift from the
    // mouse version over time).
    const resizeTo = (clientX, clientY) => {
        const drag = resizeRef.current;
        if (!drag) return;
        const dx = clientX - drag.startX;
        const dy = clientY - drag.startY;
        const maxWidth = window.innerWidth * 0.92;
        const maxHeight = window.innerHeight * 0.86;
        const minWidth = effectiveMinWidth();
        const minHeight = effectiveMinHeight();
        let { startWidth: width, startHeight: height, startTop: top, startLeft: left } = drag;

        if (drag.direction.includes('e')) width = Math.min(maxWidth, Math.max(minWidth, drag.startWidth + dx));
        if (drag.direction.includes('s')) height = Math.min(maxHeight, Math.max(minHeight, drag.startHeight + dy));
        if (drag.direction.includes('w')) {
            width = Math.min(maxWidth, Math.max(minWidth, drag.startWidth - dx));
            left = drag.startLeft + (drag.startWidth - width); // right edge stays put
        }
        if (drag.direction.includes('n')) {
            height = Math.min(maxHeight, Math.max(minHeight, drag.startHeight - dy));
            top = drag.startTop + (drag.startHeight - height); // bottom edge stays put
        }

        setSize({ width, height });
        setPosition({ top, left });
    };

    const handleResizeMove = (e) => resizeTo(e.clientX, e.clientY);
    const handleResizeTouchMove = (e) => {
        // Real preventDefault - without it, the browser's own native page
        // scroll/pinch-zoom competes with this drag on a touch device,
        // exactly the "resize just doesn't work on mobile" symptom this
        // is meant to fix (the touch gesture was scrolling the page
        // behind the modal instead of resizing it).
        if (e.cancelable) e.preventDefault();
        const t = e.touches[0];
        if (t) resizeTo(t.clientX, t.clientY);
    };

    const stopResizing = () => {
        resizeRef.current = null;
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
        window.removeEventListener('touchmove', handleResizeTouchMove);
        window.removeEventListener('touchend', handleResizeEnd);
        window.removeEventListener('touchcancel', handleResizeEnd);
    };
    const handleResizeEnd = () => stopResizing();

    const beginResize = (direction, startX, startY) => {
        resizeRef.current = {
            direction, startX, startY,
            startWidth: size.width, startHeight: size.height,
            startTop: position.top, startLeft: position.left,
        };
    };

    const handleResizeStart = (direction) => (e) => {
        e.preventDefault();
        e.stopPropagation();
        beginResize(direction, e.clientX, e.clientY);
        window.addEventListener('mousemove', handleResizeMove);
        window.addEventListener('mouseup', handleResizeEnd);
    };
    const handleResizeTouchStart = (direction) => (e) => {
        e.stopPropagation();
        const t = e.touches[0];
        if (!t) return;
        beginResize(direction, t.clientX, t.clientY);
        // passive:false - see the preventDefault note in
        // handleResizeTouchMove above; a passive listener can't call
        // preventDefault at all, so this needs to be explicit here even
        // though React's own onTouchMove prop already sets this listener
        // non-passive by default (this one is added imperatively via
        // addEventListener, which defaults to passive:true instead).
        window.addEventListener('touchmove', handleResizeTouchMove, { passive: false });
        window.addEventListener('touchend', handleResizeEnd);
        window.addEventListener('touchcancel', handleResizeEnd);
    };

    // Same real mouse/touch-shared-core pattern as resize above.
    const dragTo = (clientX, clientY) => {
        const drag = dragRef.current;
        if (!drag) return;
        // Clamped so at least ~60px of the title bar always stays reachable
        // within the viewport - the window can be moved almost anywhere,
        // but never fully lost off-screen.
        const nextTop = Math.min(window.innerHeight - 60, Math.max(-size.height + 60, drag.startTop + (clientY - drag.startY)));
        const nextLeft = Math.min(window.innerWidth - 60, Math.max(-size.width + 60, drag.startLeft + (clientX - drag.startX)));
        setPosition({ top: nextTop, left: nextLeft });
    };

    const handleDragMove = (e) => dragTo(e.clientX, e.clientY);
    const handleDragTouchMove = (e) => {
        if (e.cancelable) e.preventDefault();
        const t = e.touches[0];
        if (t) dragTo(t.clientX, t.clientY);
    };

    const stopDragging = () => {
        dragRef.current = null;
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchmove', handleDragTouchMove);
        window.removeEventListener('touchend', handleDragEnd);
        window.removeEventListener('touchcancel', handleDragEnd);
    };
    const handleDragEnd = () => stopDragging();

    const handleDragStart = (e) => {
        e.preventDefault();
        dragRef.current = { startX: e.clientX, startY: e.clientY, startTop: position.top, startLeft: position.left };
        window.addEventListener('mousemove', handleDragMove);
        window.addEventListener('mouseup', handleDragEnd);
    };
    const handleDragTouchStart = (e) => {
        const t = e.touches[0];
        if (!t) return;
        dragRef.current = { startX: t.clientX, startY: t.clientY, startTop: position.top, startLeft: position.left };
        window.addEventListener('touchmove', handleDragTouchMove, { passive: false });
        window.addEventListener('touchend', handleDragEnd);
        window.addEventListener('touchcancel', handleDragEnd);
    };

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }, [data]);

    const activeSection = data.sections.find((s) => s.id === activeSectionId) || data.sections[0];
    const activeNote = activeSection?.notes.find((n) => n.id === activeNoteId) || null;

    // Custom, in-app replacements for window.prompt/alert/confirm - native
    // browser dialogs are jarring against a custom-styled glass UI, and
    // some hosting/embedding contexts block them outright. promptState
    // handles both "add section" and "rename section" (same shape, just a
    // different initial value and confirm callback); confirmState handles
    // the delete confirmation; toastMessage is a brief, non-blocking
    // banner for the "can't delete the last section" info message, which
    // never needed to block anything in the first place.
    const [promptState, setPromptState] = useState(null); // null | { title, initialValue, onConfirm }
    const [confirmState, setConfirmState] = useState(null); // null | { message, onConfirm }
    const [toastMessage, setToastMessage] = useState('');
    useEffect(() => {
        if (!toastMessage) return undefined;
        const timeoutId = setTimeout(() => setToastMessage(''), 3000);
        return () => clearTimeout(timeoutId);
    }, [toastMessage]);

    useEffect(() => {
        setDraftTitle(activeNote ? activeNote.title : '');
        setDraftContent(activeNote ? activeNote.content : '');
    }, [activeNoteId, activeSectionId]);

    const addSection = () => {
        setPromptState({
            title: 'New Section',
            initialValue: '',
            onConfirm: (title) => {
                const newSection = { id: generateId('section'), title: title.trim(), notes: [] };
                setData((prev) => ({ sections: [...prev.sections, newSection] }));
                setActiveSectionId(newSection.id);
                setActiveNoteId(null);
                setPromptState(null);
            },
        });
    };

    const deleteSection = (sectionId) => {
        if (data.sections.length <= 1) {
            setToastMessage("Can't delete the last remaining section.");
            return;
        }
        setConfirmState({
            message: 'Delete this section and all its notes?',
            onConfirm: () => {
                setData((prev) => {
                    const updated = prev.sections.filter((s) => s.id !== sectionId);
                    return { sections: updated };
                });
                if (activeSectionId === sectionId) {
                    const remaining = data.sections.filter((s) => s.id !== sectionId);
                    setActiveSectionId(remaining[0]?.id);
                    setActiveNoteId(null);
                }
                setConfirmState(null);
            },
        });
    };

    const addNote = () => {
        if (!activeSection) return;
        const newNote = { id: generateId('note'), title: 'New Note', content: '', updatedAt: Date.now() };
        setData((prev) => ({
            sections: prev.sections.map((s) =>
                s.id === activeSection.id ? { ...s, notes: [newNote, ...s.notes] } : s
            ),
        }));
        setActiveNoteId(newNote.id);
    };

    const saveActiveNote = () => {
        if (!activeSection || !activeNote) return;
        setData((prev) => ({
            sections: prev.sections.map((s) =>
                s.id !== activeSection.id
                    ? s
                    : {
                          ...s,
                          notes: s.notes.map((n) =>
                              n.id === activeNote.id
                                  ? { ...n, title: draftTitle.trim() || 'Untitled', content: draftContent, updatedAt: Date.now() }
                                  : n
                          ),
                      }
            ),
        }));
    };

    const deleteNote = (noteId) => {
        if (!activeSection) return;
        setData((prev) => ({
            sections: prev.sections.map((s) =>
                s.id === activeSection.id ? { ...s, notes: s.notes.filter((n) => n.id !== noteId) } : s
            ),
        }));
        if (activeNoteId === noteId) setActiveNoteId(null);
    };

    const renameSection = (sectionId) => {
        const section = data.sections.find((s) => s.id === sectionId);
        setPromptState({
            title: 'Rename Section',
            initialValue: section?.title || '',
            onConfirm: (title) => {
                setData((prev) => ({
                    sections: prev.sections.map((s) => (s.id === sectionId ? { ...s, title: title.trim() } : s)),
                }));
                setPromptState(null);
            },
        });
    };

    // Real, true inline renaming for a note's title directly in the
    // middle (Notes) column - not the same as the writing panel's own
    // title <input>, which only appears once a note is already open.
    // Placeholder titles like "New Note" can now be renamed right from
    // the list, without opening the note first. editingNoteId is
    // deliberately separate from activeNoteId (selecting/opening a note)
    // so entering rename mode never also swaps the writing panel's
    // content out from under an unrelated note the user might currently
    // be reading.
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [draftNoteTitle, setDraftNoteTitle] = useState('');

    const startRenamingNote = (note) => {
        setEditingNoteId(note.id);
        setDraftNoteTitle(note.title);
    };

    const commitNoteRename = (sectionId, noteId) => {
        const title = draftNoteTitle.trim() || 'Untitled';
        setData((prev) => ({
            sections: prev.sections.map((s) =>
                s.id !== sectionId
                    ? s
                    : { ...s, notes: s.notes.map((n) => (n.id === noteId ? { ...n, title, updatedAt: Date.now() } : n)) }
            ),
        }));
        // Keeps the writing panel's own title input in sync if this same
        // note happens to already be open there too - otherwise saving
        // from the writing panel afterward would silently overwrite this
        // rename with the panel's own stale draftTitle.
        if (activeNoteId === noteId) setDraftTitle(title);
        setEditingNoteId(null);
    };

    // Mobile drill-down helpers - each just moves mobileView forward/back
    // a step, on top of the exact same activeSectionId/activeNoteId state
    // desktop already uses. Opening a note explicitly saves whatever was
    // open before it (rather than relying solely on the textarea's own
    // onBlur, which still fires here too, but a step earlier - explicit
    // is safer than depending on blur ordering across a full view swap).
    const openSectionMobile = (sectionId) => {
        setActiveSectionId(sectionId);
        setActiveNoteId(null);
        setMobileView('notes');
    };
    const openNoteMobile = (noteId) => {
        setActiveNoteId(noteId);
        setMobileView('note');
    };
    const backToSectionsMobile = () => {
        saveActiveNote();
        setMobileView('sections');
    };
    const backToNotesMobile = () => {
        saveActiveNote();
        setMobileView('notes');
    };
    const addNoteMobile = () => {
        addNote();
        setMobileView('note');
    };

    if (isMobile) {
        // Full-screen sheet, not the desktop's small floating/draggable/
        // resizable window - dragging and resizing a tiny window makes no
        // sense on a touch screen, and a real, reported bug was exactly
        // that: the desktop window's own sizing math (clamped to ~92% of
        // the viewport, positioned with position:fixed top/left px) still
        // rendered as a small floating card with visible page behind it
        // on a phone, not a real full-screen mobile modal.
        const mobileTitle = mobileView === 'sections' ? 'Quick Notes' : mobileView === 'notes' ? (activeSection?.title || 'Notes') : (activeNote ? (draftTitle || 'Untitled') : 'New Note');
        const mobileBack = mobileView === 'notes' ? backToSectionsMobile : mobileView === 'note' ? backToNotesMobile : null;

        return createPortal(
            <div style={{ position: 'fixed', inset: 0, zIndex: 200000, background: 'var(--bg-main)', display: 'flex', flexDirection: 'column' }}>
                <div style={{
                    flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '12px 14px', paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
                    borderBottom: '1px solid var(--border-premium)', background: 'var(--bg-surface)',
                }}>
                    {mobileBack ? (
                        <button onClick={mobileBack} aria-label="Back" style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', padding: '4px', flexShrink: 0 }}>
                            <ArrowLeft size={20} />
                        </button>
                    ) : (
                        <StickyNote size={18} color="var(--accent)" style={{ flexShrink: 0 }} />
                    )}
                    <strong style={{ flex: 1, minWidth: 0, fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mobileTitle}</strong>
                    {mobileView === 'note' && activeNote && (
                        <>
                            <button onClick={saveActiveNote} title="Save" style={{ background: 'var(--primary)', border: 'none', color: '#fff', borderRadius: '8px', padding: '7px 12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}><Check size={13} /> Save</button>
                            <button onClick={() => { deleteNote(activeNote.id); setMobileView('notes'); }} title="Delete Note" style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', color: '#EF4444', borderRadius: '8px', padding: '7px 9px', cursor: 'pointer', display: 'flex', flexShrink: 0 }}><Trash2 size={14} /></button>
                        </>
                    )}
                    <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '4px', flexShrink: 0 }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    {mobileView === 'sections' && (
                        <div style={{ padding: '8px 4px' }}>
                            <button
                                onClick={addSection}
                                style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '14px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-premium)', color: 'var(--accent)', fontSize: '15px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                            >
                                <FolderPlus size={18} /> New Section
                            </button>
                            {data.sections.map((section) => (
                                <div
                                    key={section.id}
                                    onClick={() => openSectionMobile(section.id)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: '1px solid var(--border-premium)', cursor: 'pointer' }}
                                >
                                    <span style={{ flex: 1, minWidth: 0, fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{section.title}</span>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>{section.notes.length}</span>
                                    <Pencil size={15} onClick={(e) => { e.stopPropagation(); renameSection(section.id); }} title="Rename section" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                    <Trash2 size={15} onClick={(e) => { e.stopPropagation(); deleteSection(section.id); }} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                    <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                </div>
                            ))}
                        </div>
                    )}

                    {mobileView === 'notes' && (
                        <div style={{ padding: '8px 4px' }}>
                            <button
                                onClick={addNoteMobile}
                                style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '14px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-premium)', color: 'var(--accent)', fontSize: '15px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                            >
                                <Plus size={18} /> New Note
                            </button>
                            {(activeSection?.notes || []).length === 0 && (
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '20px 16px', textAlign: 'center' }}>No notes yet.</p>
                            )}
                            {(activeSection?.notes || []).map((note) => (
                                <div
                                    key={note.id}
                                    onClick={() => { if (editingNoteId !== note.id) openNoteMobile(note.id); }}
                                    style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-premium)', cursor: 'pointer' }}
                                >
                                    {editingNoteId === note.id ? (
                                        <input
                                            autoFocus
                                            value={draftNoteTitle}
                                            onChange={(e) => setDraftNoteTitle(e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            onBlur={() => commitNoteRename(activeSection.id, note.id)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') { e.preventDefault(); commitNoteRename(activeSection.id, note.id); }
                                                else if (e.key === 'Escape') { e.preventDefault(); setEditingNoteId(null); }
                                            }}
                                            aria-label="Note title"
                                            style={{ width: '100%', fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', background: 'var(--widget-bg)', border: '1px solid var(--primary)', borderRadius: '8px', padding: '6px 10px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                                        />
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note.title}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>{note.content || 'Empty note'}</div>
                                            </div>
                                            <Pencil size={15} onClick={(e) => { e.stopPropagation(); startRenamingNote(note); }} title="Rename note" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                            <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {mobileView === 'note' && (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '16px' }}>
                            {activeNote ? (
                                <>
                                    <input
                                        value={draftTitle}
                                        onChange={(e) => setDraftTitle(e.target.value)}
                                        onBlur={saveActiveNote}
                                        placeholder="Note title..."
                                        aria-label="Note title"
                                        style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '14px', padding: 0 }}
                                    />
                                    <textarea
                                        value={draftContent}
                                        onChange={(e) => setDraftContent(e.target.value)}
                                        onBlur={saveActiveNote}
                                        placeholder="Start writing - a clean, distraction-free space..."
                                        aria-label="Note content"
                                        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: '15px', lineHeight: 1.7, color: 'var(--text-secondary)', fontFamily: 'inherit' }}
                                    />
                                </>
                            ) : (
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '10px', color: 'var(--text-muted)' }}>
                                    <StickyNote size={32} />
                                    <p style={{ fontSize: '13px' }}>Select a note, or create a new one to start writing.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {promptState && (
                    <TextPromptModal
                        title={promptState.title}
                        initialValue={promptState.initialValue}
                        onConfirm={promptState.onConfirm}
                        onCancel={() => setPromptState(null)}
                    />
                )}
                {confirmState && (
                    <ConfirmModal
                        message={confirmState.message}
                        onConfirm={confirmState.onConfirm}
                        onCancel={() => setConfirmState(null)}
                    />
                )}
                {toastMessage && (
                    <div style={{
                        position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 220000,
                        background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '14px',
                        padding: '12px 20px', boxShadow: 'var(--premium-shadow)', color: 'var(--text-primary)',
                        fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px',
                    }}>
                        <StickyNote size={15} color="var(--accent)" />
                        {toastMessage}
                    </div>
                )}
            </div>,
            document.body
        );
    }

    return (
        // BUGFIX (outside-click dismissal during resize/drag): the backdrop
        // previously had onClick={onClose}, which - combined with native
        // CSS resize - could fire a synthetic "click" on the backdrop if a
        // resize/drag's mouseup happened to land outside the panel (browsers
        // resolve a click's target to the nearest common ancestor of the
        // mousedown/mouseup targets, which IS the backdrop when a drag
        // starts on a child and ends over it). Per the explicit requirement,
        // outside-click-to-dismiss is removed entirely now - the backdrop
        // has no onClick at all, so nothing but the X button can close this.
        //
        // Rendered via a portal directly into document.body, not inline
        // where this component happens to be mounted (inside header.jsx,
        // as a sibling after </header> - NOT actually nested inside the
        // header's own position:sticky + z-index stacking context, which
        // was the original suspected cause). This is the definitive fix
        // regardless of the exact root cause: a portal guarantees this
        // modal can never be trapped inside ANY ancestor's stacking
        // context - not header.jsx's, not any other component's, present
        // or future - which no z-index value alone can guarantee as long
        // as the modal stays nested in the normal component tree. The
        // z-index itself is also raised to definitively exceed every
        // other value anywhere in this codebase, including the dev-only
        // diagnostic overlays, since a user's own notes should never be
        // capable of being covered by anything.
        createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 200000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
            <div
                style={{
                    position: 'fixed', top: `${position.top}px`, left: `${position.left}px`,
                    width: `${size.width}px`, height: `${size.height}px`,
                    background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '24px',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.45)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                }}
            >
                {/* Title bar: drag-to-move handle, and the only control that closes the modal */}
                <div
                    onMouseDown={handleDragStart}
                    onTouchStart={handleDragTouchStart}
                    style={{
                        flexShrink: 0, height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0 10px 0 16px', borderBottom: '1px solid var(--border-premium)', cursor: 'move', userSelect: 'none', touchAction: 'none',
                    }}
                >
                    <strong style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <StickyNote size={15} color="var(--accent)" /> Quick Notes
                    </strong>
                    <button
                        onClick={onClose}
                        onMouseDown={(e) => e.stopPropagation()}
                        title="Close"
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '6px' }}
                    >
                        <X size={17} />
                    </button>
                </div>

                {/* Body: sections / notes list / writing panel, side by
                    side - desktop only now (see the isMobile early return
                    above, which renders a completely different one-pane-
                    at-a-time drill-down flow instead of this 3-column
                    layout). The overflowX/WebkitOverflowScrolling here is
                    a genuine desktop safety net too: the window itself
                    can still be resized narrower than the three columns'
                    combined min width (2x220px fixed + a 260px min
                    writing panel, ~700px), so this scrolls independently
                    rather than silently clipping a column beyond view. */}
                <div style={{ flex: 1, display: 'flex', minHeight: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <div style={{ width: '220px', flexShrink: 0, borderRight: '1px solid var(--border-premium)', display: 'flex', flexDirection: 'column', padding: '18px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 6px 14px 6px' }}>
                        <strong style={{ fontSize: '14px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>Sections</strong>
                        <button onClick={addSection} title="Add Section" style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', display: 'flex' }}><FolderPlus size={17} /></button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', flex: 1 }}>
                        {data.sections.map((section) => (
                            <div
                                key={section.id}
                                onClick={() => { setActiveSectionId(section.id); setActiveNoteId(null); }}
                                onDoubleClick={() => renameSection(section.id)}
                                title="Double-click, or the pencil icon, to rename"
                                style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '9px 10px', borderRadius: '10px', cursor: 'pointer',
                                    background: activeSectionId === section.id ? 'var(--primary-muted)' : 'transparent',
                                    color: activeSectionId === section.id ? 'var(--accent)' : 'var(--text-secondary)',
                                    fontSize: '13px', fontWeight: '700',
                                }}
                            >
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{section.title}</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{section.notes.length}</span>
                                    {/* A visible rename affordance - double-click alone (kept
                                        above, unchanged) is a real but undiscoverable gesture;
                                        this icon makes the same action findable without
                                        requiring the user to already know it exists. */}
                                    <Pencil size={12} onClick={(e) => { e.stopPropagation(); renameSection(section.id); }} title="Rename section" style={{ opacity: 0.6 }} />
                                    <Trash2 size={12} onClick={(e) => { e.stopPropagation(); deleteSection(section.id); }} style={{ opacity: 0.6 }} />
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Notes list column */}
                <div style={{ width: '220px', flexShrink: 0, borderRight: '1px solid var(--border-premium)', display: 'flex', flexDirection: 'column', padding: '18px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 6px 14px 6px' }}>
                        <strong style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{activeSection?.title || 'Notes'}</strong>
                        <button onClick={addNote} title="New Note" style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', display: 'flex' }}><Plus size={17} /></button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', flex: 1 }}>
                        {(activeSection?.notes || []).length === 0 && (
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '0 6px' }}>No notes yet.</p>
                        )}
                        {(activeSection?.notes || []).map((note) => (
                            <div
                                key={note.id}
                                onClick={() => { if (editingNoteId !== note.id) setActiveNoteId(note.id); }}
                                onDoubleClick={() => startRenamingNote(note)}
                                style={{
                                    padding: '9px 10px', borderRadius: '10px', cursor: 'pointer',
                                    background: activeNoteId === note.id ? 'var(--widget-bg)' : 'transparent',
                                    border: activeNoteId === note.id ? '1px solid var(--border-premium)' : '1px solid transparent',
                                }}
                            >
                                {editingNoteId === note.id ? (
                                    <input
                                        autoFocus
                                        value={draftNoteTitle}
                                        onChange={(e) => setDraftNoteTitle(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        onBlur={() => commitNoteRename(activeSection.id, note.id)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') { e.preventDefault(); commitNoteRename(activeSection.id, note.id); }
                                            else if (e.key === 'Escape') { e.preventDefault(); setEditingNoteId(null); }
                                        }}
                                        aria-label="Note title"
                                        style={{ width: '100%', fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', background: 'var(--bg-main)', border: '1px solid var(--primary)', borderRadius: '6px', padding: '3px 6px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                                    />
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <div style={{ flex: 1, minWidth: 0, fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note.title}</div>
                                        {/* Same visible-pencil convention as Sections above -
                                            double-click also still works (onDoubleClick on the
                                            row itself), this is just the discoverable version. */}
                                        <Pencil size={11} onClick={(e) => { e.stopPropagation(); startRenamingNote(note); }} title="Rename note" style={{ opacity: 0.5, flexShrink: 0 }} />
                                    </div>
                                )}
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note.content || 'Empty note'}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Writing panel */}
                <div style={{ flex: 1, minWidth: '260px', display: 'flex', flexDirection: 'column', padding: '18px 22px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '10px' }}>
                        {activeNote && (
                            <>
                                <button onClick={saveActiveNote} title="Save" style={{ background: 'var(--primary)', border: 'none', color: '#fff', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}><Check size={13} /> Save</button>
                                <button onClick={() => deleteNote(activeNote.id)} title="Delete Note" style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', color: '#EF4444', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', display: 'flex' }}><Trash2 size={14} /></button>
                            </>
                        )}
                    </div>

                    {activeNote ? (
                        <>
                            <input
                                value={draftTitle}
                                onChange={(e) => setDraftTitle(e.target.value)}
                                onBlur={saveActiveNote}
                                placeholder="Note title..."
                                aria-label="Note title"
                                style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '14px', padding: 0 }}
                            />
                            <textarea
                                value={draftContent}
                                onChange={(e) => setDraftContent(e.target.value)}
                                onBlur={saveActiveNote}
                                placeholder="Start writing - a clean, distraction-free space..."
                                aria-label="Note content"
                                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: '14px', lineHeight: 1.7, color: 'var(--text-secondary)', fontFamily: 'inherit' }}
                            />
                        </>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '10px', color: 'var(--text-muted)' }}>
                            <StickyNote size={32} />
                            <p style={{ fontSize: '13px' }}>Select a note, or create a new one to start writing.</p>
                        </div>
                    )}
                </div>
                </div>

                {RESIZE_HANDLES.map(({ dir, style }) => (
                    <div
                        key={dir}
                        onMouseDown={handleResizeStart(dir)}
                        onTouchStart={handleResizeTouchStart(dir)}
                        style={{ position: 'absolute', zIndex: 3, touchAction: 'none', ...style }}
                    />
                ))}
                {/* Small visible grip in the bottom-right corner only, as a
                    subtle affordance - the other 7 handles are invisible
                    (edges/corners of any modern floating window are resize-
                    draggable without a visible grip on each one). Purely
                    decorative: pointerEvents:'none' lets mouse events pass
                    straight through to the functional 'se' handle rendered
                    just above by the RESIZE_HANDLES map. */}
                <div
                    style={{
                        position: 'absolute', right: '3px', bottom: '3px', width: '14px', height: '14px',
                        zIndex: 4, opacity: 0.55, pointerEvents: 'none',
                        backgroundImage: 'repeating-linear-gradient(135deg, var(--text-muted) 0px, var(--text-muted) 1.5px, transparent 1.5px, transparent 5px)',
                    }}
                />
            </div>

            {promptState && (
                <TextPromptModal
                    title={promptState.title}
                    initialValue={promptState.initialValue}
                    onConfirm={promptState.onConfirm}
                    onCancel={() => setPromptState(null)}
                />
            )}
            {confirmState && (
                <ConfirmModal
                    message={confirmState.message}
                    onConfirm={confirmState.onConfirm}
                    onCancel={() => setConfirmState(null)}
                />
            )}
            {toastMessage && (
                <div style={{
                    position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 220000,
                    background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '14px',
                    padding: '12px 20px', boxShadow: 'var(--premium-shadow)', color: 'var(--text-primary)',
                    fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                    <StickyNote size={15} color="var(--accent)" />
                    {toastMessage}
                </div>
            )}
        </div>,
        document.body
        )
    );
};

export default QuickNotesModal;
