// src/pages/SyllabusPage.jsx
//
// Dynamic Syllabus Command Center - Part 1: semester-based navigation and
// full subject CRUD. Real, persisted data (nexus_syllabus_subjects), zero
// dummy/hardcoded curriculum - a new install starts genuinely empty per
// semester until the user actually adds their own subjects.
import { useState, useEffect, useRef } from 'react';
import {
    FileText, Plus, Pencil, Trash2, X, BookOpen, GraduationCap, CheckSquare, Square, ChevronDown, ChevronRight,
    Upload, Image as ImageIcon, SquarePlay, Languages, Loader2, AlertTriangle, ExternalLink, Sparkles,
} from 'lucide-react';
import { sanitizeNumberInput } from '../utils/smartNumberInput.js';
import { toTitleCase } from '../utils/textFormat.js';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { extractSyllabusStructure, classifySyllabusFile } from '../utils/syllabusExtraction.js';
import { resolveActiveAiProvider, readAiProviderSettings } from '../utils/aiProviderRouter.js';
import { searchYoutubeVideos, buildYoutubeSearchUrl, YoutubeApiError } from '../utils/youtubeClient.js';
import AttachmentMenu from '../components/AttachmentMenu.jsx';
import CameraCapture from '../components/CameraCapture.jsx';

const STORAGE_KEY = 'nexus_syllabus_subjects';
const SEMESTER_KEY = 'nexus_syllabus_selected_semester';
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

const ORDINAL = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th', 7: '7th', 8: '8th' };
const RESOURCE_LANG_KEY = 'nexus_syllabus_resource_lang';

// Full AI-provider key state (gemini/openai/grok/deepseek, via the shared
// readAiProviderSettings in aiProviderRouter.js) plus this page's own
// extra YouTube key - read directly from 'nexus_global_settings' for the
// same reason AIPage.jsx's own equivalent reads it directly rather than
// through GlobalUserSettingsContext's curated whitelist.
const readAiKeySettings = () => {
    const providerSettings = readAiProviderSettings();
    try {
        const saved = JSON.parse(localStorage.getItem('nexus_global_settings') || '{}');
        return {
            ...providerSettings,
            youtubeApiKey: saved.youtubeApiKey || '', youtubeApiKeyConfirmed: !!saved.youtubeApiKeyConfirmed,
        };
    } catch (e) {
        return { ...providerSettings, youtubeApiKey: '', youtubeApiKeyConfirmed: false };
    }
};

const loadSubjects = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        return Array.isArray(saved) ? saved : [];
    } catch (e) {
        return [];
    }
};

const loadSelectedSemester = () => {
    try {
        const saved = parseInt(localStorage.getItem(SEMESTER_KEY), 10);
        return SEMESTERS.includes(saved) ? saved : 1;
    } catch (e) {
        return 1;
    }
};

// Real, custom Add/Edit modal - same shape handles both (a real subject
// passed in for edit pre-fills every field; omitted entirely for add).
// Replaces any native prompt entirely - a real form, real validation
// (won't submit an empty name), real Escape/outside-click to cancel.
const SubjectModal = ({ initialSubject, defaultSemester, onSave, onCancel }) => {
    const [name, setName] = useState(initialSubject?.name || '');
    const [credits, setCredits] = useState(initialSubject ? String(initialSubject.credits) : '4');
    const [semester, setSemester] = useState(initialSubject?.semester || defaultSemester);
    const modalRef = useRef(null);

    useEffect(() => {
        const handleEscape = (e) => { if (e.key === 'Escape') onCancel(); };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onCancel]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        const parsedCredits = Math.max(0, Math.min(20, parseInt(credits, 10) || 0));
        onSave({
            id: initialSubject?.id ?? `subject_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
            name: toTitleCase(name.trim()),
            credits: parsedCredits,
            semester,
            units: initialSubject?.units || [],
        });
    };

    return (
        <div
            style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={onCancel}
        >
            <form
                ref={modalRef}
                onSubmit={handleSubmit}
                onClick={(e) => e.stopPropagation()}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '24px', padding: '28px', width: '100%', maxWidth: '400px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '18px' }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                        {initialSubject ? 'Edit Subject' : 'Add Subject'}
                    </h3>
                    <button type="button" onClick={onCancel} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
                        <X size={18} />
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label htmlFor="syllabusSubjectName" style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>Subject Name</label>
                    <input
                        id="syllabusSubjectName" name="subjectName"
                        type="text" autoFocus placeholder="e.g. Java Programming, AI/ML, React"
                        value={name} onChange={(e) => setName(e.target.value)}
                        style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="syllabusSubjectCredits" style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>Credits</label>
                        <input
                            id="syllabusSubjectCredits" name="credits"
                            type="number" min="0" max="20" value={credits}
                            onChange={(e) => setCredits(sanitizeNumberInput(e.target.value, credits))}
                            style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label htmlFor="syllabusSubjectSemester" style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)' }}>Semester</label>
                        <select
                            id="syllabusSubjectSemester" name="semester"
                            value={semester} onChange={(e) => setSemester(parseInt(e.target.value, 10))}
                            style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', cursor: 'pointer' }}
                        >
                            {SEMESTERS.map((s) => (
                                <option key={s} value={s} style={{ background: 'var(--surface-inset)' }}>{ORDINAL[s]} Semester</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                    <button type="button" onClick={onCancel} style={{ flex: 1, padding: '11px', background: 'var(--widget-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-premium)', borderRadius: '12px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
                        Cancel
                    </button>
                    <button
                        type="submit" disabled={!name.trim()}
                        style={{
                            flex: 1, padding: '11px', borderRadius: '12px', fontWeight: '700', fontSize: '13px', fontFamily: 'inherit',
                            background: name.trim() ? 'var(--primary)' : 'var(--widget-bg)',
                            color: name.trim() ? 'var(--text-on-primary)' : 'var(--text-muted)',
                            border: name.trim() ? 'none' : '1px solid var(--border-premium)',
                            cursor: name.trim() ? 'pointer' : 'default',
                        }}
                    >
                        {initialSubject ? 'Save Changes' : 'Add Subject'}
                    </button>
                </div>
            </form>
        </div>
    );
};

// Real, custom delete confirmation - replaces window.confirm entirely,
// matching the same convention already established across the rest of
// this app (Settings, Quick Notes).
const DeleteConfirmModal = ({ subjectName, onConfirm, onCancel }) => {
    useEffect(() => {
        const handleEscape = (e) => { if (e.key === 'Escape') onCancel(); };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onCancel]);

    return (
        <div
            style={{ position: 'fixed', inset: 0, zIndex: 5100, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={onCancel}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '26px', width: '100%', maxWidth: '340px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
                <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>Delete Subject</strong>
                <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    Delete <strong style={{ color: 'var(--text-primary)' }}>{subjectName}</strong> and all its tracked topics? This cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" onClick={onCancel} style={{ flex: 1, padding: '10px', background: 'var(--widget-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-premium)', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                    <button type="button" onClick={onConfirm} style={{ flex: 1, padding: '10px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
                </div>
            </div>
        </div>
    );
};

// The per-topic YouTube resource surface - opened on demand (not
// pre-fetched for every topic on mount, which would burn real quota for
// units the user never looks at). Two honest render paths depending on
// whether a real YouTube key is configured: real embeddable video cards
// (thumbnail, title, channel - all genuine API data), or, with no key,
// a single real "Search on YouTube" deep-link card. Never fabricates a
// video that wasn't actually returned by the API.
const TopicResourcePanel = ({ topic, language, youtubeApiKey, youtubeReady }) => {
    const [status, setStatus] = useState('idle'); // idle | loading | done | error
    const [videos, setVideos] = useState([]);
    const [error, setError] = useState('');
    const [activeVideoId, setActiveVideoId] = useState(null);

    useEffect(() => {
        setStatus('idle');
        setVideos([]);
        setError('');
        setActiveVideoId(null);
    }, [topic.id, language]);

    useEffect(() => {
        if (status !== 'idle' || !youtubeReady) return;
        let cancelled = false;
        const controller = new AbortController();
        setStatus('loading');
        searchYoutubeVideos({ apiKey: youtubeApiKey, topicName: topic.name, language, maxResults: 3, signal: controller.signal })
            .then((results) => {
                if (cancelled) return;
                setVideos(results);
                setStatus('done');
            })
            .catch((e) => {
                if (cancelled || e.name === 'AbortError') return;
                setError(e instanceof YoutubeApiError ? e.message : 'Could not load YouTube resources for this topic.');
                setStatus('error');
            });
        return () => { cancelled = true; controller.abort(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, youtubeReady]);

    const searchUrl = buildYoutubeSearchUrl(topic.name, language);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', borderRadius: '10px', background: 'var(--surface-inset)', border: '1px solid var(--border-premium)' }}>
            {!youtubeReady ? (
                <a
                    href={searchUrl} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', color: 'var(--text-primary)', textDecoration: 'none' }}
                >
                    <SquarePlay size={18} color="#EF4444" style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: '12px', fontWeight: '700' }}>Search "{topic.name}" on YouTube</span>
                    <ExternalLink size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                </a>
            ) : status === 'loading' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600' }}>
                    <Loader2 size={14} style={{ animation: 'nexusSyllabusSpin 0.8s linear infinite' }} /> Finding real videos for this topic…
                    <style>{'@keyframes nexusSyllabusSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}</style>
                </div>
            ) : status === 'error' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#F59E0B', fontSize: '12px', fontWeight: '600' }}>
                        <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} /> <span>{error}</span>
                    </div>
                    <a href={searchUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: 'var(--accent)', textDecoration: 'none' }}>
                        <ExternalLink size={12} /> Search on YouTube instead
                    </a>
                </div>
            ) : videos.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>No videos found for this topic.</span>
                    <a href={searchUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: 'var(--accent)', textDecoration: 'none' }}>
                        <ExternalLink size={12} /> Search on YouTube instead
                    </a>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
                    {videos.map((v) => (
                        <div key={v.videoId} style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                            {activeVideoId === v.videoId ? (
                                <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: '8px', overflow: 'hidden', background: '#000' }}>
                                    <iframe
                                        src={`https://www.youtube.com/embed/${v.videoId}?autoplay=1`}
                                        title={v.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                                    />
                                </div>
                            ) : (
                                <button
                                    type="button" onClick={() => setActiveVideoId(v.videoId)}
                                    style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: '8px', overflow: 'hidden', border: 'none', padding: 0, cursor: 'pointer', background: '#000' }}
                                    title={`Play "${v.title}"`}
                                >
                                    {v.thumbnailUrl && <img src={v.thumbnailUrl} alt={v.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                                    <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }}>
                                        <span style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(239,68,68,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <SquarePlay size={16} color="#fff" />
                                        </span>
                                    </span>
                                </button>
                            )}
                            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{v.title}</span>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.channelTitle}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// A single, real, click-to-complete checkbox row for one topic - toggling
// it immediately flips its own done state and re-triggers the parent
// subject's live progress recalculation, no separate "save" step.
const TopicRow = ({ topic, onToggle, onRename, onDelete, language, youtubeApiKey, youtubeReady, autoOpenResources }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [draftName, setDraftName] = useState(topic.name);
    // Starts open for the topic the user just added (autoOpenResources) so
    // its YouTube suggestions load automatically, exactly like every
    // other topic's own on-demand panel - just pre-toggled once, for this
    // one topic, instead of requiring an extra click right after adding it.
    const [showResources, setShowResources] = useState(!!autoOpenResources);

    const commitRename = () => {
        setIsEditing(false);
        if (draftName.trim() && draftName.trim() !== topic.name) onRename(toTitleCase(draftName.trim()));
        else setDraftName(topic.name);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '10px', background: 'var(--surface-inset)' }}>
                <button type="button" onClick={onToggle} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', flexShrink: 0, padding: 0 }} title={topic.done ? 'Mark as not done' : 'Mark as done'}>
                    {topic.done ? <CheckSquare size={18} color="var(--success)" /> : <Square size={18} color="var(--text-muted)" />}
                </button>
                {isEditing ? (
                    <input
                        autoFocus value={draftName} aria-label="Topic name"
                        onChange={(e) => setDraftName(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setDraftName(topic.name); setIsEditing(false); } }}
                        style={{ flex: 1, minWidth: 0, background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '6px', padding: '4px 8px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                    />
                ) : (
                    <span style={{ flex: 1, minWidth: 0, fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', opacity: topic.done ? 0.6 : 1, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {topic.name}
                    </span>
                )}
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <button type="button" onClick={() => setShowResources((v) => !v)} title="YouTube resources" style={{ background: showResources ? 'rgba(239, 68, 68, 0.12)' : 'transparent', border: 'none', borderRadius: '6px', color: showResources ? '#EF4444' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '4px' }}><SquarePlay size={13} /></button>
                    <button type="button" onClick={() => setIsEditing(true)} title="Rename topic" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '4px' }}><Pencil size={12} /></button>
                    <button type="button" onClick={onDelete} title="Delete topic" style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', display: 'flex', padding: '4px' }}><X size={14} /></button>
                </div>
            </div>
            {showResources && (
                <TopicResourcePanel topic={topic} language={language} youtubeApiKey={youtubeApiKey} youtubeReady={youtubeReady} />
            )}
        </div>
    );
};

// One collapsible unit block - its own real progress bar, a real inline
// "+ Add Topic" form (no nested modal), and the list of TopicRows above.
// Collapsible specifically so a subject with several units full of
// topics doesn't turn into an overwhelming wall of checkboxes at once.
const UnitBlock = ({ unit, onRenameUnit, onDeleteUnit, onAddTopic, onToggleTopic, onRenameTopic, onDeleteTopic, language, youtubeApiKey, youtubeReady, lastAddedTopicId }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [isRenamingUnit, setIsRenamingUnit] = useState(false);
    const [unitDraftName, setUnitDraftName] = useState(unit.name);
    const [isAddingTopic, setIsAddingTopic] = useState(false);
    const [newTopicName, setNewTopicName] = useState('');

    const doneCount = unit.topics.filter((t) => t.done).length;
    const totalCount = unit.topics.length;
    const percent = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

    const commitUnitRename = () => {
        setIsRenamingUnit(false);
        if (unitDraftName.trim() && unitDraftName.trim() !== unit.name) onRenameUnit(toTitleCase(unitDraftName.trim()));
        else setUnitDraftName(unit.name);
    };

    const submitNewTopic = (e) => {
        e.preventDefault();
        if (!newTopicName.trim()) return;
        onAddTopic(toTitleCase(newTopicName.trim()));
        setNewTopicName('');
        setIsAddingTopic(false);
    };

    return (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button type="button" onClick={() => setIsExpanded((v) => !v)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 0, flexShrink: 0 }}>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                {isRenamingUnit ? (
                    <input
                        autoFocus value={unitDraftName} aria-label="Unit name"
                        onChange={(e) => setUnitDraftName(e.target.value)}
                        onBlur={commitUnitRename}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitUnitRename(); if (e.key === 'Escape') { setUnitDraftName(unit.name); setIsRenamingUnit(false); } }}
                        style={{ flex: 1, minWidth: 0, background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '8px', padding: '6px 10px', color: 'var(--text-primary)', fontSize: '14px', fontWeight: '700', outline: 'none' }}
                    />
                ) : (
                    <span style={{ flex: 1, minWidth: 0, fontSize: '14px', fontWeight: '800', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{unit.name}</span>
                )}
                <span style={{ fontSize: '11px', fontWeight: '700', color: totalCount > 0 ? 'var(--success)' : 'var(--text-muted)', flexShrink: 0 }}>
                    {totalCount === 0 ? 'No topics' : `${doneCount}/${totalCount} · ${percent}%`}
                </span>
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <button type="button" onClick={() => setIsRenamingUnit(true)} title="Rename unit" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '4px' }}><Pencil size={13} /></button>
                    <button type="button" onClick={onDeleteUnit} title="Delete unit" style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', display: 'flex', padding: '4px' }}><Trash2 size={13} /></button>
                </div>
            </div>

            {totalCount > 0 && (
                <div style={{ width: '100%', height: '5px', borderRadius: '10px', background: 'var(--surface-inset)', overflow: 'hidden' }}>
                    <div style={{ width: `${percent}%`, height: '100%', background: 'var(--success)', borderRadius: '10px', transition: 'width 0.3s ease' }} />
                </div>
            )}

            {isExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {unit.topics.map((topic) => (
                        <TopicRow
                            key={topic.id}
                            topic={topic}
                            onToggle={() => onToggleTopic(topic.id)}
                            onRename={(newName) => onRenameTopic(topic.id, newName)}
                            onDelete={() => onDeleteTopic(topic.id)}
                            language={language}
                            youtubeApiKey={youtubeApiKey}
                            youtubeReady={youtubeReady}
                            autoOpenResources={topic.id === lastAddedTopicId}
                        />
                    ))}

                    {isAddingTopic ? (
                        <form onSubmit={submitNewTopic} style={{ display: 'flex', gap: '6px' }}>
                            <input
                                autoFocus type="text" placeholder="Topic name" aria-label="New topic name" value={newTopicName}
                                onChange={(e) => setNewTopicName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Escape') { setIsAddingTopic(false); setNewTopicName(''); } }}
                                style={{ flex: 1, minWidth: 0, background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '8px', padding: '7px 10px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                            />
                            <button type="submit" disabled={!newTopicName.trim()} style={{ padding: '7px 12px', borderRadius: '8px', border: 'none', background: newTopicName.trim() ? 'var(--primary)' : 'var(--widget-bg)', color: newTopicName.trim() ? 'var(--text-on-primary)' : 'var(--text-muted)', fontWeight: '700', fontSize: '12px', cursor: newTopicName.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>Add</button>
                            <button type="button" onClick={() => { setIsAddingTopic(false); setNewTopicName(''); }} style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-secondary)', fontWeight: '700', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}><X size={13} /></button>
                        </form>
                    ) : (
                        <button
                            type="button" onClick={() => setIsAddingTopic(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 10px', borderRadius: '8px', border: '1px dashed var(--border-premium)', background: 'transparent', color: 'var(--text-muted)', fontWeight: '700', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'flex-start' }}
                        >
                            <Plus size={13} /> Add Topic
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

// The full unit/topic management surface for one subject - Part 2's core
// deliverable. Kept as a genuinely separate, dedicated modal (rather than
// crammed into the compact grid card) specifically to avoid the layout
// crowding the request explicitly calls out - the main grid stays clean,
// and this is where the real depth lives.
// The syllabus upload + review surface - mirrors StatementImportModal's
// own established philosophy exactly: parsing (here, Gemini's real
// extraction) is inherently heuristic, so nothing is silently committed.
// Upload -> extract -> a real per-unit/per-topic review checklist -> the
// user explicitly commits via "Import N Units". SyllabusImportModal never
// touches the subject's real data itself; it only ever hands the parent
// a finished, user-approved array via onImport.
const SyllabusImportModal = ({ settings, onImport, onClose }) => {
    const [stage, setStage] = useState('upload'); // 'upload' | 'extracting' | 'review' | 'error'
    const [fileName, setFileName] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [extractedUnits, setExtractedUnits] = useState([]);
    const [included, setIncluded] = useState({});
    const [extractedDeadlines, setExtractedDeadlines] = useState([]);
    const [includedDeadlines, setIncludedDeadlines] = useState({});
    const [isDragOver, setIsDragOver] = useState(false);
    const [attachMenuOpen, setAttachMenuOpen] = useState(false);
    const fileInputRef = useRef(null);
    const attachTriggerRef = useRef(null);
    const cameraCaptureRef = useRef(null);
    const abortRef = useRef(null);
    const isMobile = useIsMobile();

    useEffect(() => () => abortRef.current?.abort(), []);

    const activeAiProvider = resolveActiveAiProvider(settings);

    const runExtraction = async (file) => {
        setFileName(file.name);
        setStage('extracting');
        const controller = new AbortController();
        abortRef.current = controller;
        try {
            const { units, deadlines } = await extractSyllabusStructure({ file, settings, signal: controller.signal });
            if (units.length === 0 && deadlines.length === 0) {
                setErrorMessage('No syllabus content could be found in this file. Try a clearer photo, or a different file.');
                setStage('error');
                return;
            }
            setExtractedUnits(units);
            setIncluded(Object.fromEntries(units.map((u) => [u.id, { checked: true, topics: Object.fromEntries(u.topics.map((t) => [t.id, true])) }])));
            setExtractedDeadlines(deadlines);
            setIncludedDeadlines(Object.fromEntries(deadlines.map((d) => [d.id, true])));
            setStage('review');
        } catch (e) {
            if (e.name === 'AbortError') return;
            setErrorMessage(e.message || 'Something went wrong reading this file. Please try again.');
            setStage('error');
        }
    };

    // Classified client-side first (real, immediate feedback for a
    // genuinely unsupported format like .docx) rather than always
    // routing through the API call just to get the same honest error
    // extractSyllabusStructure would throw anyway. Same for the
    // photo-needs-Gemini check - classifySyllabusFile already tells us
    // whether this is an image before any network call happens.
    const handleFile = (file) => {
        if (!file) return;
        const kind = classifySyllabusFile(file);
        if (kind === 'unsupported' || kind === 'unsupported-doc') {
            setFileName(file.name);
            setErrorMessage(kind === 'unsupported-doc'
                ? "Word documents (.doc/.docx) aren't supported yet - please export it as a PDF, or take a photo of the pages instead."
                : 'Unsupported file type. Please upload a PDF or a photo (JPG/PNG) of the syllabus.');
            setStage('error');
            return;
        }
        if (!activeAiProvider) {
            setFileName(file.name);
            setErrorMessage('Add a Gemini, Grok, or DeepSeek API key in Settings → AI & Learning API Integrations to use syllabus import.');
            setStage('error');
            return;
        }
        if (kind === 'image' && activeAiProvider.provider === 'deepseek') {
            setFileName(file.name);
            setErrorMessage(`Photo import needs Gemini or Grok - your active AI provider is ${activeAiProvider.provider}, which can't read images here. Switch providers in Settings → AI Assistant, or upload the syllabus as a PDF instead.`);
            setStage('error');
            return;
        }
        runExtraction(file);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
    };

    const toggleUnit = (unitId) => setIncluded((prev) => ({ ...prev, [unitId]: { ...prev[unitId], checked: !prev[unitId]?.checked } }));
    const toggleTopic = (unitId, topicId) => setIncluded((prev) => ({
        ...prev,
        [unitId]: { ...prev[unitId], topics: { ...prev[unitId]?.topics, [topicId]: !prev[unitId]?.topics?.[topicId] } },
    }));
    const toggleDeadline = (deadlineId) => setIncludedDeadlines((prev) => ({ ...prev, [deadlineId]: !prev[deadlineId] }));

    const includedUnitsCount = extractedUnits.filter((u) => included[u.id]?.checked).length;
    const includedTopicsCount = extractedUnits.reduce((sum, u) => (included[u.id]?.checked ? sum + u.topics.filter((t) => included[u.id]?.topics?.[t.id]).length : sum), 0);
    const includedDeadlinesCount = extractedDeadlines.filter((d) => includedDeadlines[d.id]).length;

    const handleCommit = () => {
        const finalUnits = extractedUnits
            .filter((u) => included[u.id]?.checked)
            .map((u) => ({ ...u, topics: u.topics.filter((t) => included[u.id]?.topics?.[t.id]) }));
        const finalDeadlines = extractedDeadlines.filter((d) => includedDeadlines[d.id]);
        if (finalUnits.length === 0 && finalDeadlines.length === 0) return;
        onImport(finalUnits, finalDeadlines);
        onClose();
    };

    return (
        <div
            style={{ position: 'fixed', inset: 0, zIndex: 230000, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
            onClick={onClose}
        >
            <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '22px', padding: '26px', width: '100%', maxWidth: '640px', maxHeight: '85vh', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ minWidth: 0 }}>
                        <h3 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Sparkles size={17} color="var(--accent)" /> Import Syllabus</h3>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Drop a PDF, or a photo of a physical syllabus - your active AI provider reads and structures it into units, topics, and deadlines.</span>
                    </div>
                    <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}><X size={20} /></button>
                </div>

                {stage === 'upload' && (
                    <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                        onDragLeave={() => setIsDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            border: `2px dashed ${isDragOver ? 'var(--primary)' : 'var(--border-premium)'}`, borderRadius: '16px', padding: '40px 20px',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', cursor: 'pointer',
                            background: isDragOver ? 'rgba(var(--primary-rgb), 0.06)' : 'var(--widget-bg)', transition: 'background 0.15s, border 0.15s',
                        }}
                    >
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <Upload size={28} color="var(--primary)" />
                            <ImageIcon size={28} color="var(--primary)" />
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', textAlign: 'center' }}>Drop a syllabus file here, or click to browse</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>Supports PDF, and photos (JPG/PNG) of a physical syllabus page</div>
                        {!activeAiProvider && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '11px', fontWeight: '700', color: '#F59E0B' }}>
                                <AlertTriangle size={12} /> Requires a Gemini, Grok, or DeepSeek API key in Settings
                            </div>
                        )}
                        <input
                            ref={fileInputRef} type="file" accept=".pdf,application/pdf,image/*" aria-label="Upload syllabus file" style={{ display: 'none' }}
                            onChange={(e) => handleFile(e.target.files?.[0])}
                        />
                    </div>
                )}

                {/* Real, native-camera entry point - snap a photo of a
                    physical syllabus page and hand it straight into the
                    same extraction pipeline the dropzone/file-picker
                    above uses. Reuses AttachmentMenu/CameraCapture as-is
                    (already generic, already proven in AIChatArea.jsx) -
                    no new camera UI, just a second, mobile-first way to
                    reach the exact same handleFile(). */}
                {stage === 'upload' && (
                    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                        <button
                            type="button" ref={attachTriggerRef} onClick={() => setAttachMenuOpen((v) => !v)}
                            style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 16px', borderRadius: '9999px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontWeight: '700', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                            <Plus size={14} color="var(--accent)" /> Use Camera or Photo
                        </button>
                        <AttachmentMenu
                            isOpen={attachMenuOpen}
                            onClose={() => setAttachMenuOpen(false)}
                            onCamera={() => cameraCaptureRef.current?.open()}
                            onFileSelected={(file) => { setAttachMenuOpen(false); handleFile(file); }}
                            filesAccept=".pdf,application/pdf,image/*"
                            showCamera={isMobile}
                            style={{ bottom: 'calc(100% + 8px)' }}
                            triggerRef={attachTriggerRef}
                        />
                        <CameraCapture
                            ref={cameraCaptureRef}
                            onCapture={(file) => handleFile(file)}
                        />
                    </div>
                )}

                {stage === 'extracting' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '40px 20px' }}>
                        <Loader2 size={30} color="var(--primary)" style={{ animation: 'nexusSyllabusSpin 0.9s linear infinite' }} />
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Reading {fileName}…</div>
                        <style>{'@keyframes nexusSyllabusSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}</style>
                    </div>
                )}

                {stage === 'error' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '16px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '12px' }}>
                            <AlertTriangle size={18} color="#EF4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{errorMessage}</span>
                        </div>
                        <button type="button" onClick={() => { setStage('upload'); setFileName(''); setErrorMessage(''); }} style={{ padding: '12px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>Try a Different File</button>
                    </div>
                )}

                {stage === 'review' && (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '12px' }}>
                            <Sparkles size={14} color="var(--success)" style={{ flexShrink: 0 }} />
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Review what was found below - uncheck anything that isn't right before importing. Nothing is saved yet.</span>
                        </div>

                        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '2px' }}>
                            {extractedDeadlines.length > 0 && (
                                <div style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>Deadlines found ({extractedDeadlines.length})</span>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {extractedDeadlines.map((d) => (
                                            <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                                <input type="checkbox" checked={!!includedDeadlines[d.id]} onChange={() => toggleDeadline(d.id)} />
                                                <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 7px', borderRadius: '8px', color: d.type === 'Exam' ? '#EF4444' : '#F59E0B', background: d.type === 'Exam' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)', flexShrink: 0 }}>{d.type}</span>
                                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flex: 1, minWidth: 0 }}>{d.title}</span>
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>{d.date}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {extractedUnits.map((unit) => (
                                <div key={unit.id} style={{ background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', opacity: included[unit.id]?.checked ? 1 : 0.5 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={!!included[unit.id]?.checked} onChange={() => toggleUnit(unit.id)} />
                                        <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>{unit.name}</span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>({unit.topics.length} topics)</span>
                                    </label>
                                    {unit.topics.length > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '24px' }}>
                                            {unit.topics.map((topic) => (
                                                <label key={topic.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                                    <input type="checkbox" checked={!!included[unit.id]?.topics?.[topic.id]} onChange={() => toggleTopic(unit.id, topic.id)} disabled={!included[unit.id]?.checked} />
                                                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{topic.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', flex: 1 }}>
                                {includedUnitsCount} unit{includedUnitsCount === 1 ? '' : 's'} · {includedTopicsCount} topic{includedTopicsCount === 1 ? '' : 's'}
                                {extractedDeadlines.length > 0 ? ` · ${includedDeadlinesCount} deadline${includedDeadlinesCount === 1 ? '' : 's'}` : ''} selected
                            </span>
                            <button type="button" onClick={() => { setStage('upload'); setFileName(''); setExtractedUnits([]); setIncluded({}); setExtractedDeadlines([]); setIncludedDeadlines({}); }} style={{ padding: '11px 16px', background: 'var(--widget-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-premium)', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}>Start Over</button>
                            <button
                                type="button" onClick={handleCommit} disabled={includedUnitsCount === 0 && includedDeadlinesCount === 0}
                                style={{ padding: '11px 20px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: (includedUnitsCount === 0 && includedDeadlinesCount === 0) ? 'default' : 'pointer', opacity: (includedUnitsCount === 0 && includedDeadlinesCount === 0) ? 0.5 : 1, fontSize: '13px', fontFamily: 'inherit' }}
                            >
                                Import {includedUnitsCount} Unit{includedUnitsCount === 1 ? '' : 's'}{includedDeadlinesCount > 0 ? ` + ${includedDeadlinesCount} Deadline${includedDeadlinesCount === 1 ? '' : 's'}` : ''}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// Writes AI-extracted deadlines straight into the app's real, existing
// assignment tracker (nexus_study_assignments) - the exact same key and
// shape StudyPage.jsx's own manual "Add Assignment" form writes
// ({id, title, subject, dueDate, status}), plus one new optional `type`
// field ('Assignment'|'Exam') so the study-queue/UI can tell them apart.
// This is deliberately NOT a new, parallel deadline store - dropping
// items into the real one means they show up in StudyPage's existing
// Assignments tab AND in HomePage's Master Schedule Flow automatically,
// via TaskRegistryContext's own normalizeStudyAssignments, with zero new
// wiring. Same manual window.dispatchEvent('storage') convention every
// other same-tab writer in this app already uses.
const commitExtractedDeadlines = (deadlines, subjectName) => {
    if (!deadlines || deadlines.length === 0) return;
    try {
        const existing = JSON.parse(localStorage.getItem('nexus_study_assignments') || '[]');
        const now = Date.now();
        const newAssignments = deadlines.map((d, idx) => ({
            id: `${now}_${idx}_${Math.floor(Math.random() * 100000)}`,
            title: d.title,
            subject: subjectName,
            dueDate: d.date,
            status: 'Pending',
            type: d.type,
        }));
        localStorage.setItem('nexus_study_assignments', JSON.stringify([...newAssignments, ...(Array.isArray(existing) ? existing : [])]));
        window.dispatchEvent(new Event('storage'));
    } catch (e) { /* localStorage unavailable - deadlines just won't be tracked this time */ }
};

const SubjectDetailModal = ({ subject, onUpdate, onClose, settings, youtubeApiKey, youtubeReady }) => {
    const [isAddingUnit, setIsAddingUnit] = useState(false);
    const [newUnitName, setNewUnitName] = useState('');
    const [showImportModal, setShowImportModal] = useState(false);
    const [resourceLanguage, setResourceLanguage] = useState(() => {
        try {
            const saved = localStorage.getItem(RESOURCE_LANG_KEY);
            return saved === 'hi' ? 'hi' : 'en';
        } catch (e) {
            return 'en';
        }
    });

    useEffect(() => {
        localStorage.setItem(RESOURCE_LANG_KEY, resourceLanguage);
    }, [resourceLanguage]);

    useEffect(() => {
        const handleEscape = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    const allTopics = subject.units.flatMap((u) => u.topics);
    const doneCount = allTopics.filter((t) => t.done).length;
    const totalCount = allTopics.length;
    const overallPercent = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

    const updateUnits = (nextUnits) => onUpdate({ ...subject, units: nextUnits });

    const addUnit = (e) => {
        e.preventDefault();
        if (!newUnitName.trim()) return;
        const newUnit = { id: `unit_${Date.now()}_${Math.floor(Math.random() * 100000)}`, name: toTitleCase(newUnitName.trim()), topics: [] };
        updateUnits([...subject.units, newUnit]);
        setNewUnitName('');
        setIsAddingUnit(false);
    };

    // Appends imported units after the existing ones - never replaces or
    // reorders what's already there. Extraction generates fresh ids per
    // unit/topic already, so this is a plain, safe concatenation.
    // Deadlines are committed separately, straight into the real
    // assignment tracker (see commitExtractedDeadlines above) - they
    // aren't part of this subject's own units/topics shape.
    //
    // Order matters here, confirmed with a real, reproducible bug: deadlines
    // are committed FIRST, units SECOND. commitExtractedDeadlines writes
    // directly to localStorage and dispatches 'storage' synchronously - if
    // that ran AFTER updateUnits, it would fire while this page's own
    // setSubjects() update from updateUnits is still just a pending React
    // state update (not yet flushed to localStorage by this page's own
    // outbound-sync effect). The dispatched event's own inbound-sync
    // listener would then read localStorage's still-STALE subjects array
    // and overwrite the pending in-memory update with it, silently
    // dropping the newly-imported units the instant they were added.
    // Deadlines-first avoids this: its dispatch fires while subjects is
    // still genuinely unchanged (a harmless no-op read), and updateUnits'
    // own state change - and the real localStorage write for it - only
    // happens after, with nothing left to race it.
    const commitImport = (newUnits, newDeadlines) => {
        commitExtractedDeadlines(newDeadlines, subject.name);
        if (newUnits.length > 0) updateUnits([...subject.units, ...newUnits]);
    };

    const renameUnit = (unitId, newName) => updateUnits(subject.units.map((u) => (u.id === unitId ? { ...u, name: newName } : u)));
    const deleteUnit = (unitId) => updateUnits(subject.units.filter((u) => u.id !== unitId));
    // Tracks the just-created topic's own id so its TopicRow (below) can
    // auto-open its YouTube resource panel - a real, automatic fetch for
    // the topic the user just added, without pre-fetching for every
    // existing topic on every render (see TopicResourcePanel's own
    // comment on why that would burn real quota for topics the user never
    // actually looks at).
    const [lastAddedTopicId, setLastAddedTopicId] = useState(null);
    const addTopic = (unitId, name) => {
        const newTopicId = `topic_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
        updateUnits(subject.units.map((u) => (u.id === unitId ? { ...u, topics: [...u.topics, { id: newTopicId, name, done: false }] } : u)));
        setLastAddedTopicId(newTopicId);
    };
    const toggleTopic = (unitId, topicId) => updateUnits(subject.units.map((u) => (u.id === unitId ? { ...u, topics: u.topics.map((t) => (t.id === topicId ? { ...t, done: !t.done } : t)) } : u)));
    const renameTopic = (unitId, topicId, newName) => updateUnits(subject.units.map((u) => (u.id === unitId ? { ...u, topics: u.topics.map((t) => (t.id === topicId ? { ...t, name: newName } : t)) } : u)));
    const deleteTopic = (unitId, topicId) => updateUnits(subject.units.map((u) => (u.id === unitId ? { ...u, topics: u.topics.filter((t) => t.id !== topicId) } : u)));

    return (
        <>
        <div
            style={{ position: 'fixed', inset: 0, zIndex: 220000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '24px', padding: '26px', width: '100%', maxWidth: '620px', maxHeight: '85vh', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '18px' }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ minWidth: 0 }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>{subject.name}</h3>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {totalCount === 0 ? 'No topics tracked yet' : `${doneCount}/${totalCount} topics · ${overallPercent}% complete`}
                        </span>
                    </div>
                    <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}><X size={20} /></button>
                </div>

                {totalCount > 0 && (
                    <div style={{ width: '100%', height: '7px', borderRadius: '10px', background: 'var(--surface-inset)', overflow: 'hidden', flexShrink: 0 }}>
                        <div style={{ width: `${overallPercent}%`, height: '100%', background: 'var(--success)', borderRadius: '10px', transition: 'width 0.3s ease' }} />
                    </div>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexShrink: 0 }}>
                    <button
                        type="button" onClick={() => setShowImportModal(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 14px', borderRadius: '9999px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontWeight: '700', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                        <Sparkles size={13} color="var(--accent)" /> Import Syllabus
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px', borderRadius: '9999px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)' }} title="Learning resource language">
                        <Languages size={12} color="var(--text-muted)" style={{ marginLeft: '6px' }} />
                        {[['en', 'English'], ['hi', 'हिंदी']].map(([code, label]) => (
                            <button
                                key={code} type="button" onClick={() => setResourceLanguage(code)}
                                style={{
                                    padding: '5px 12px', borderRadius: '9999px', border: 'none', fontWeight: '700', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit',
                                    background: resourceLanguage === code ? 'var(--primary)' : 'transparent',
                                    color: resourceLanguage === code ? 'var(--text-on-primary)' : 'var(--text-secondary)',
                                }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '2px' }}>
                    {subject.units.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '32px 20px', textAlign: 'center' }}>
                            <BookOpen size={28} color="var(--text-muted)" />
                            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>No units yet</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                Add structured blocks like "Unit 1", "CT1", or "PL" to start tracking topics.
                            </span>
                        </div>
                    ) : (
                        subject.units.map((unit) => (
                            <UnitBlock
                                key={unit.id}
                                unit={unit}
                                onRenameUnit={(newName) => renameUnit(unit.id, newName)}
                                onDeleteUnit={() => deleteUnit(unit.id)}
                                onAddTopic={(name) => addTopic(unit.id, name)}
                                onToggleTopic={(topicId) => toggleTopic(unit.id, topicId)}
                                onRenameTopic={(topicId, newName) => renameTopic(unit.id, topicId, newName)}
                                onDeleteTopic={(topicId) => deleteTopic(unit.id, topicId)}
                                language={resourceLanguage}
                                youtubeApiKey={youtubeApiKey}
                                youtubeReady={youtubeReady}
                                lastAddedTopicId={lastAddedTopicId}
                            />
                        ))
                    )}
                </div>

                {isAddingUnit ? (
                    <form onSubmit={addUnit} style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <input
                            autoFocus type="text" placeholder="e.g. Unit 1, CT1, PL" aria-label="New unit name" value={newUnitName}
                            onChange={(e) => setNewUnitName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Escape') { setIsAddingUnit(false); setNewUnitName(''); } }}
                            style={{ flex: 1, minWidth: 0, background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                        />
                        <button type="submit" disabled={!newUnitName.trim()} style={{ padding: '10px 16px', borderRadius: '10px', border: 'none', background: newUnitName.trim() ? 'var(--primary)' : 'var(--widget-bg)', color: newUnitName.trim() ? 'var(--text-on-primary)' : 'var(--text-muted)', fontWeight: '700', fontSize: '13px', cursor: newUnitName.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}>Add</button>
                        <button type="button" onClick={() => { setIsAddingUnit(false); setNewUnitName(''); }} style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-secondary)', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}><X size={14} /></button>
                    </form>
                ) : (
                    <button
                        type="button" onClick={() => setIsAddingUnit(true)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '11px', borderRadius: '12px', border: '1px dashed var(--border-premium)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                    >
                        <Plus size={15} /> Add Unit
                    </button>
                )}
            </div>
        </div>
        {showImportModal && (
            <SyllabusImportModal
                settings={settings}
                onImport={commitImport}
                onClose={() => setShowImportModal(false)}
            />
        )}
        </>
    );
};

const SyllabusPage = () => {
    const isMobile = useIsMobile();
    const [subjects, setSubjects] = useState(loadSubjects);
    const [selectedSemester, setSelectedSemester] = useState(loadSelectedSemester);
    const [modalMode, setModalMode] = useState(null); // null | 'add' | { editing: subject }
    const [deletingSubject, setDeletingSubject] = useState(null);
    const [viewingSubject, setViewingSubject] = useState(null); // the subject currently open in the unit/topic detail view

    // Live AI-key state, kept in sync the same way AIPage.jsx's own copy
    // of this exact pattern is - both 'nexus_settings_updated' (this
    // page's own SettingsPage writes) and the native 'storage' event
    // (what CloudSyncContext dispatches when a key arrives from another
    // device) refresh it, so a key added in Settings is usable here
    // without a reload.
    const [aiKeySettings, setAiKeySettings] = useState(readAiKeySettings);
    useEffect(() => {
        const syncAiKeySettings = () => setAiKeySettings(readAiKeySettings());
        window.addEventListener('nexus_settings_updated', syncAiKeySettings);
        window.addEventListener('storage', syncAiKeySettings);
        return () => {
            window.removeEventListener('nexus_settings_updated', syncAiKeySettings);
            window.removeEventListener('storage', syncAiKeySettings);
        };
    }, []);
    const youtubeReady = aiKeySettings.youtubeApiKeyConfirmed && !!aiKeySettings.youtubeApiKey.trim();

    // Consumes the one-time "jump target" signal StudyPage's Jump to
    // Syllabus button writes before navigating here - auto-selects the
    // right semester and opens that exact subject's detail view the
    // instant this page mounts. Cleared immediately after reading so a
    // later, unrelated visit to this page never re-triggers it.
    useEffect(() => {
        try {
            const raw = localStorage.getItem('nexus_syllabus_jump_target');
            if (!raw) return;
            localStorage.removeItem('nexus_syllabus_jump_target');
            const { subjectId, semester } = JSON.parse(raw);
            const target = subjects.find((s) => s.id === subjectId);
            if (!target) return;
            if (SEMESTERS.includes(semester)) setSelectedSemester(semester);
            setViewingSubject(target);
        } catch (e) { /* malformed/missing jump target - page just opens normally */ }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Outbound sync - matches the same convention every other source
    // module in this app already follows, so any future cross-component
    // consumer (or another tab) picks up a change immediately.
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(subjects));
        window.dispatchEvent(new Event('storage'));
    }, [subjects]);

    useEffect(() => {
        localStorage.setItem(SEMESTER_KEY, String(selectedSemester));
    }, [selectedSemester]);

    // Inbound sync - picks up a change made elsewhere (another tab, or a
    // future external writer) while this page happens to be mounted. The
    // equality guard prevents this component's own outbound write above
    // from re-triggering itself in a loop.
    useEffect(() => {
        const handleExternalChange = () => {
            try {
                const latest = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
                setSubjects((prev) => (JSON.stringify(prev) === JSON.stringify(latest) ? prev : latest));
            } catch (e) { /* malformed data elsewhere - keep current state rather than clearing it */ }
        };
        window.addEventListener('storage', handleExternalChange);
        return () => window.removeEventListener('storage', handleExternalChange);
    }, []);

    const subjectsForSemester = subjects.filter((s) => s.semester === selectedSemester);

    const handleSaveSubject = (subject) => {
        setSubjects((prev) => {
            const exists = prev.some((s) => s.id === subject.id);
            return exists ? prev.map((s) => (s.id === subject.id ? subject : s)) : [...prev, subject];
        });
        setModalMode(null);
    };

    const handleConfirmDelete = () => {
        setSubjects((prev) => prev.filter((s) => s.id !== deletingSubject.id));
        setDeletingSubject(null);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px', animation: 'fadeInScale 0.3s ease' }}>
            {/* background: var(--bg-surface) alone is what gives this card
                its real, theme-aware glassmorphism - it's automatically
                blurred/translucent under the Dynamic theme's own selector
                system and cleanly opaque under the other three. The old
                .widget class this page used to render with ALSO forced a
                flat backdrop-filter: blur(12px) unconditionally in every
                theme, including onto an already fully-opaque background on
                night/comfort/day - blurring nothing while still costing a
                compositing layer, which is exactly what read as "blurry
                edges / uneven color rendering" on the semester tabs and
                action bar sitting on top of it. Every other page in this
                app already uses this same plain convention; this page was
                simply the one left behind on the older system. */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: isMobile ? '18px' : '24px', padding: isMobile ? '16px' : '24px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: isMobile ? '12px' : '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FileText size={isMobile ? 20 : 24} color="var(--accent)" style={{ flexShrink: 0 }} />
                        <h2 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Syllabus Hub</h2>
                    </div>
                    <button
                        type="button"
                        onClick={() => setModalMode('add')}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            padding: isMobile ? '12px 18px' : '11px 20px', width: isMobile ? '100%' : 'auto', boxSizing: 'border-box',
                            borderRadius: '9999px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none',
                            fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
                        }}
                    >
                        <Plus size={16} /> Add Subject
                    </button>
                </div>

                {/* Semester Switcher - a clean, horizontally-scrollable tab
                    row (matches the same day-selector pattern already
                    established for Timetable), 1 through 8. Switching
                    semesters is a pure filter over subjectsForSemester
                    below - instant, no reload, no fetch. */}
                <div style={{
                    display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px',
                    maskImage: isMobile ? 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)' : 'none',
                    WebkitMaskImage: isMobile ? 'linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)' : 'none',
                }}>
                    {SEMESTERS.map((sem) => (
                        <button
                            key={sem}
                            type="button"
                            onClick={() => setSelectedSemester(sem)}
                            style={{
                                padding: '10px 18px', borderRadius: '9999px', fontSize: '13px', fontWeight: '700',
                                cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit', flexShrink: 0,
                                background: selectedSemester === sem ? 'var(--primary)' : 'var(--widget-bg)',
                                color: selectedSemester === sem ? 'var(--text-on-primary)' : 'var(--text-primary)',
                                border: '1px solid var(--border-premium)',
                            }}
                        >
                            {ORDINAL[sem]} Semester
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: isMobile ? '18px' : '24px', padding: isMobile ? '16px' : '24px', boxShadow: 'var(--premium-shadow)', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: isMobile ? '14px' : '18px' }}>
                    <GraduationCap size={18} color="var(--accent)" style={{ flexShrink: 0 }} />
                    <h3 style={{ fontSize: isMobile ? '14px' : '15px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ORDINAL[selectedSemester]} Semester Subjects
                    </h3>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', background: 'var(--surface-inset)', padding: '2px 10px', borderRadius: '20px', flexShrink: 0 }}>
                        {subjectsForSemester.length}
                    </span>
                </div>

                {subjectsForSemester.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: isMobile ? '36px 20px' : '48px 20px', boxSizing: 'border-box', textAlign: 'center' }}>
                        <BookOpen size={32} color="var(--text-muted)" />
                        <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                            No subjects added for {ORDINAL[selectedSemester]} Semester yet
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Click "Add Subject" above to build out this semester's curriculum.
                        </span>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: isMobile ? '10px' : '16px' }}>
                        {subjectsForSemester.map((subject) => {
                            const allTopics = subject.units.flatMap((u) => u.topics);
                            const doneCount = allTopics.filter((t) => t.done).length;
                            const totalTopics = allTopics.length;
                            return (
                                <div key={subject.id} onClick={() => setViewingSubject(subject)} style={{
                                    background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: isMobile ? '14px' : '16px',
                                    padding: isMobile ? '14px' : '18px', display: 'flex', flexDirection: 'column', gap: isMobile ? '10px' : '12px', cursor: 'pointer', minWidth: 0,
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                        <h4 style={{
                                            fontSize: isMobile ? '13px' : '15px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, lineHeight: 1.3, minWidth: 0,
                                            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflowWrap: 'break-word', wordBreak: 'break-word',
                                        }}>{subject.name}</h4>
                                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); setModalMode({ editing: subject }); }}
                                                title="Edit subject"
                                                style={{ background: 'var(--surface-inset)', border: '1px solid var(--border-premium)', borderRadius: '8px', padding: '6px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}
                                            >
                                                <Pencil size={13} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); setDeletingSubject(subject); }}
                                                title="Delete subject"
                                                style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '6px', color: '#EF4444', cursor: 'pointer', display: 'flex' }}
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: '700', color: 'var(--accent)', background: 'var(--surface-inset)', padding: '3px 10px', borderRadius: '20px', border: '1px solid var(--border-premium)', flexShrink: 0 }}>
                                            {subject.credits} {subject.credits === 1 ? 'Credit' : 'Credits'}
                                        </span>
                                        <span style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: '600', color: 'var(--text-muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {subject.units.length === 0
                                                ? 'Tap to add units'
                                                : totalTopics === 0
                                                    ? `${subject.units.length} unit${subject.units.length === 1 ? '' : 's'} · no topics yet`
                                                    : `${doneCount}/${totalTopics} topics done`}
                                        </span>
                                    </div>

                                    {totalTopics > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{ width: '100%', height: '6px', borderRadius: '10px', background: 'var(--surface-inset)', overflow: 'hidden' }}>
                                                <div style={{ width: `${Math.round((doneCount / totalTopics) * 100)}%`, height: '100%', background: 'var(--success)', borderRadius: '10px', transition: 'width 0.3s ease' }} />
                                            </div>
                                            <span style={{ fontSize: isMobile ? '10px' : '11px', fontWeight: '700', color: 'var(--success)', alignSelf: 'flex-end' }}>
                                                {Math.round((doneCount / totalTopics) * 100)}% complete
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {(modalMode === 'add' || (modalMode && modalMode.editing)) && (
                <SubjectModal
                    initialSubject={modalMode === 'add' ? null : modalMode.editing}
                    defaultSemester={selectedSemester}
                    onSave={handleSaveSubject}
                    onCancel={() => setModalMode(null)}
                />
            )}

            {deletingSubject && (
                <DeleteConfirmModal
                    subjectName={deletingSubject.name}
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setDeletingSubject(null)}
                />
            )}

            {viewingSubject && (
                <SubjectDetailModal
                    subject={viewingSubject}
                    onUpdate={(updatedSubject) => {
                        handleSaveSubject(updatedSubject);
                        // viewingSubject is its own snapshot, separate from
                        // the subjects array - without also updating it
                        // here, the open modal would keep showing the old
                        // units/topics until closed and reopened, even
                        // though the underlying data already changed.
                        setViewingSubject(updatedSubject);
                    }}
                    onClose={() => setViewingSubject(null)}
                    settings={aiKeySettings}
                    youtubeApiKey={aiKeySettings.youtubeApiKey}
                    youtubeReady={youtubeReady}
                />
            )}
        </div>
    );
};

export default SyllabusPage;
