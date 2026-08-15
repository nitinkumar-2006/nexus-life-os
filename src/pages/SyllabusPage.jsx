// src/pages/SyllabusPage.jsx
//
// Dynamic Syllabus Command Center - Part 1: semester-based navigation and
// full subject CRUD. Real, persisted data (nexus_syllabus_subjects), zero
// dummy/hardcoded curriculum - a new install starts genuinely empty per
// semester until the user actually adds their own subjects.
import { useState, useEffect, useRef } from 'react';
import { FileText, Plus, Pencil, Trash2, X, BookOpen, GraduationCap, CheckSquare, Square, ChevronDown, ChevronRight } from 'lucide-react';
import { sanitizeNumberInput } from '../utils/smartNumberInput.js';
import { toTitleCase } from '../utils/textFormat.js';
import { useIsMobile } from '../hooks/useIsMobile.js';

const STORAGE_KEY = 'nexus_syllabus_subjects';
const SEMESTER_KEY = 'nexus_syllabus_selected_semester';
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

const ORDINAL = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th', 7: '7th', 8: '8th' };

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
            style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
            style={{ position: 'fixed', inset: 0, zIndex: 5100, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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

// A single, real, click-to-complete checkbox row for one topic - toggling
// it immediately flips its own done state and re-triggers the parent
// subject's live progress recalculation, no separate "save" step.
const TopicRow = ({ topic, onToggle, onRename, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [draftName, setDraftName] = useState(topic.name);

    const commitRename = () => {
        setIsEditing(false);
        if (draftName.trim() && draftName.trim() !== topic.name) onRename(toTitleCase(draftName.trim()));
        else setDraftName(topic.name);
    };

    return (
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
                <button type="button" onClick={() => setIsEditing(true)} title="Rename topic" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '4px' }}><Pencil size={12} /></button>
                <button type="button" onClick={onDelete} title="Delete topic" style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', display: 'flex', padding: '4px' }}><X size={14} /></button>
            </div>
        </div>
    );
};

// One collapsible unit block - its own real progress bar, a real inline
// "+ Add Topic" form (no nested modal), and the list of TopicRows above.
// Collapsible specifically so a subject with several units full of
// topics doesn't turn into an overwhelming wall of checkboxes at once.
const UnitBlock = ({ unit, onRenameUnit, onDeleteUnit, onAddTopic, onToggleTopic, onRenameTopic, onDeleteTopic }) => {
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
const SubjectDetailModal = ({ subject, onUpdate, onClose }) => {
    const [isAddingUnit, setIsAddingUnit] = useState(false);
    const [newUnitName, setNewUnitName] = useState('');

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

    const renameUnit = (unitId, newName) => updateUnits(subject.units.map((u) => (u.id === unitId ? { ...u, name: newName } : u)));
    const deleteUnit = (unitId) => updateUnits(subject.units.filter((u) => u.id !== unitId));
    const addTopic = (unitId, name) => updateUnits(subject.units.map((u) => (u.id === unitId ? { ...u, topics: [...u.topics, { id: `topic_${Date.now()}_${Math.floor(Math.random() * 100000)}`, name, done: false }] } : u)));
    const toggleTopic = (unitId, topicId) => updateUnits(subject.units.map((u) => (u.id === unitId ? { ...u, topics: u.topics.map((t) => (t.id === topicId ? { ...t, done: !t.done } : t)) } : u)));
    const renameTopic = (unitId, topicId, newName) => updateUnits(subject.units.map((u) => (u.id === unitId ? { ...u, topics: u.topics.map((t) => (t.id === topicId ? { ...t, name: newName } : t)) } : u)));
    const deleteTopic = (unitId, topicId) => updateUnits(subject.units.map((u) => (u.id === unitId ? { ...u, topics: u.topics.filter((t) => t.id !== topicId) } : u)));

    return (
        <div
            style={{ position: 'fixed', inset: 0, zIndex: 220000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '24px', padding: '26px', width: '100%', maxWidth: '560px', maxHeight: '85vh', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '18px' }}
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
    );
};

const SyllabusPage = () => {
    const isMobile = useIsMobile();
    const [subjects, setSubjects] = useState(loadSubjects);
    const [selectedSemester, setSelectedSemester] = useState(loadSelectedSemester);
    const [modalMode, setModalMode] = useState(null); // null | 'add' | { editing: subject }
    const [deletingSubject, setDeletingSubject] = useState(null);
    const [viewingSubject, setViewingSubject] = useState(null); // the subject currently open in the unit/topic detail view

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
        <div className="dashboard-grid">
            <div className="widget col-12" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <FileText size={24} color="var(--accent)" />
                        <div>
                            <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Syllabus Command Center</h2>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Track your curriculum, semester by semester.</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setModalMode('add')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 20px', borderRadius: '12px',
                            background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none',
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
                                padding: '10px 18px', borderRadius: '12px', fontSize: '13px', fontWeight: '700',
                                cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
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

            <div className="widget col-12" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                    <GraduationCap size={18} color="var(--accent)" />
                    <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                        {ORDINAL[selectedSemester]} Semester Subjects
                    </h3>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', background: 'var(--surface-inset)', padding: '2px 10px', borderRadius: '20px' }}>
                        {subjectsForSemester.length}
                    </span>
                </div>

                {subjectsForSemester.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '48px 20px', textAlign: 'center' }}>
                        <BookOpen size={32} color="var(--text-muted)" />
                        <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                            No subjects added for {ORDINAL[selectedSemester]} Semester yet
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Click "Add Subject" above to build out this semester's curriculum.
                        </span>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                        {subjectsForSemester.map((subject) => {
                            const allTopics = subject.units.flatMap((u) => u.topics);
                            const doneCount = allTopics.filter((t) => t.done).length;
                            const totalTopics = allTopics.length;
                            return (
                                <div key={subject.id} onClick={() => setViewingSubject(subject)} style={{
                                    background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', borderRadius: '16px',
                                    padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                                        <h4 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, lineHeight: 1.3, minWidth: 0, overflowWrap: 'break-word' }}>{subject.name}</h4>
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
                                        <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent)', background: 'var(--surface-inset)', padding: '3px 10px', borderRadius: '20px', border: '1px solid var(--border-premium)' }}>
                                            {subject.credits} {subject.credits === 1 ? 'Credit' : 'Credits'}
                                        </span>
                                        <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)' }}>
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
                                            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--success)', alignSelf: 'flex-end' }}>
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
                />
            )}
        </div>
    );
};

export default SyllabusPage;
