// src/components/QuickNotesModal.jsx
//
// A self-contained Quick Notes system: section-based categorization (custom,
// user-named sections, each holding its own notes), full CRUD on both
// sections and notes, and a clean, distraction-free writing panel - all
// persisted to localStorage so notes survive reloads.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, FolderPlus, StickyNote, Check } from 'lucide-react';

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
            style={{ position: 'fixed', inset: 0, zIndex: 210000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
            style={{ position: 'fixed', inset: 0, zIndex: 210000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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

const QuickNotesModal = ({ onClose }) => {
    const [data, setData] = useState(loadNotesData);
    const [activeSectionId, setActiveSectionId] = useState(() => loadNotesData().sections[0]?.id);
    const [activeNoteId, setActiveNoteId] = useState(null);
    const [draftTitle, setDraftTitle] = useState('');
    const [draftContent, setDraftContent] = useState('');

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
    const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
    const [position, setPosition] = useState(() => ({
        top: Math.max(16, (window.innerHeight - DEFAULT_HEIGHT) / 2),
        left: Math.max(16, (window.innerWidth - DEFAULT_WIDTH) / 2),
    }));
    const resizeRef = useRef(null);
    const dragRef = useRef(null);

    const handleResizeMove = (e) => {
        const drag = resizeRef.current;
        if (!drag) return;
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        const maxWidth = window.innerWidth * 0.92;
        const maxHeight = window.innerHeight * 0.86;
        let { startWidth: width, startHeight: height, startTop: top, startLeft: left } = drag;

        if (drag.direction.includes('e')) width = Math.min(maxWidth, Math.max(MIN_WIDTH, drag.startWidth + dx));
        if (drag.direction.includes('s')) height = Math.min(maxHeight, Math.max(MIN_HEIGHT, drag.startHeight + dy));
        if (drag.direction.includes('w')) {
            width = Math.min(maxWidth, Math.max(MIN_WIDTH, drag.startWidth - dx));
            left = drag.startLeft + (drag.startWidth - width); // right edge stays put
        }
        if (drag.direction.includes('n')) {
            height = Math.min(maxHeight, Math.max(MIN_HEIGHT, drag.startHeight - dy));
            top = drag.startTop + (drag.startHeight - height); // bottom edge stays put
        }

        setSize({ width, height });
        setPosition({ top, left });
    };

    const handleResizeEnd = () => {
        resizeRef.current = null;
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
    };

    const handleResizeStart = (direction) => (e) => {
        e.preventDefault();
        e.stopPropagation();
        resizeRef.current = {
            direction, startX: e.clientX, startY: e.clientY,
            startWidth: size.width, startHeight: size.height,
            startTop: position.top, startLeft: position.left,
        };
        window.addEventListener('mousemove', handleResizeMove);
        window.addEventListener('mouseup', handleResizeEnd);
    };

    const handleDragMove = (e) => {
        const drag = dragRef.current;
        if (!drag) return;
        // Clamped so at least ~60px of the title bar always stays reachable
        // within the viewport - the window can be moved almost anywhere,
        // but never fully lost off-screen.
        const nextTop = Math.min(window.innerHeight - 60, Math.max(-size.height + 60, drag.startTop + (e.clientY - drag.startY)));
        const nextLeft = Math.min(window.innerWidth - 60, Math.max(-size.width + 60, drag.startLeft + (e.clientX - drag.startX)));
        setPosition({ top: nextTop, left: nextLeft });
    };

    const handleDragEnd = () => {
        dragRef.current = null;
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
    };

    const handleDragStart = (e) => {
        e.preventDefault();
        dragRef.current = { startX: e.clientX, startY: e.clientY, startTop: position.top, startLeft: position.left };
        window.addEventListener('mousemove', handleDragMove);
        window.addEventListener('mouseup', handleDragEnd);
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 200000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}>
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
                    style={{
                        flexShrink: 0, height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0 10px 0 16px', borderBottom: '1px solid var(--border-premium)', cursor: 'move', userSelect: 'none',
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

                {/* Body: sections / notes list / writing panel, side by side */}
                <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
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
                                title="Double-click to rename"
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
                                onClick={() => setActiveNoteId(note.id)}
                                style={{
                                    padding: '9px 10px', borderRadius: '10px', cursor: 'pointer',
                                    background: activeNoteId === note.id ? 'var(--widget-bg)' : 'transparent',
                                    border: activeNoteId === note.id ? '1px solid var(--border-premium)' : '1px solid transparent',
                                }}
                            >
                                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note.title}</div>
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
                        style={{ position: 'absolute', zIndex: 3, ...style }}
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
