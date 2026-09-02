// src/hooks/useResizableSidebar.js
//
// Real drag-to-resize logic for the AI Sidebar's divider - useRef (not
// state) holds the in-progress drag bookkeeping (start X, start width)
// since those values only ever matter inside the mousemove handler
// itself and re-rendering on every pixel of drag would be wasteful; the
// actual width IS real state, since it drives layout and needs to
// re-render.
//
// mousemove/mouseup are attached to `document` (not the handle itself)
// ONLY while a drag is in progress, and removed the moment it ends -
// the standard, correct pattern for this kind of drag interaction so
// the cursor can leave the thin handle mid-drag without losing tracking,
// without leaving a permanent global listener registered the rest of
// the time.
import { useState, useRef, useCallback, useEffect } from 'react';

// Generalized with an optional config object (all AI Sidebar behavior
// unchanged - calling with no args keeps its exact original constants) so
// other resizable panels (e.g. Audio Hub's own sidebar) can reuse this
// same proven drag mechanism under their own storage key/min/max/default
// instead of a second, duplicated implementation.
const DEFAULTS = {
    storageKey: 'nexus_ai_sidebar_width',
    defaultWidth: 280,
    minWidth: 200,
    maxWidth: 400,
};

export const useResizableSidebar = (config = {}) => {
    const { storageKey, defaultWidth, minWidth, maxWidth } = { ...DEFAULTS, ...config };
    const clamp = useCallback((value) => Math.min(maxWidth, Math.max(minWidth, value)), [minWidth, maxWidth]);

    const loadStoredWidth = useCallback(() => {
        try {
            const saved = parseInt(localStorage.getItem(storageKey), 10);
            return Number.isFinite(saved) ? clamp(saved) : defaultWidth;
        } catch (e) {
            return defaultWidth;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [width, setWidth] = useState(loadStoredWidth);
    const [isDragging, setIsDragging] = useState(false);
    const dragState = useRef({ startX: 0, startWidth: defaultWidth });

    const handleMouseMove = useCallback((e) => {
        const delta = e.clientX - dragState.current.startX;
        setWidth(clamp(dragState.current.startWidth + delta));
    }, [clamp]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        // Persisted only once the drag actually finishes, not on every
        // intermediate pixel - localStorage.setItem on every mousemove
        // tick would be a real, needless amount of synchronous disk I/O
        // during a fast drag.
        setWidth((current) => {
            try { localStorage.setItem(storageKey, String(current)); } catch (e) { /* storage unavailable - the resize still applied for this session */ }
            return current;
        });
    }, [handleMouseMove, storageKey]);

    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        dragState.current = { startX: e.clientX, startWidth: width };
        setIsDragging(true);
        // Disabled for the duration of the drag - without this, a fast
        // mouse movement during resize selects the surrounding chat
        // text/UI labels as a real, visible side effect, since a
        // mousedown+move over text content is indistinguishable from a
        // text-selection drag to the browser otherwise.
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [width, handleMouseMove, handleMouseUp]);

    // Cleans up any still-attached listeners if the component unmounts
    // mid-drag (e.g. navigating away from the AI page while dragging).
    useEffect(() => () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
    }, [handleMouseMove, handleMouseUp]);

    return { width, isDragging, handleMouseDown, minWidth, maxWidth };
};
