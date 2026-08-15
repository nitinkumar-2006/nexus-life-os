// src/components/GpaCalculator.jsx
//
// A real, fully functional CGPA and Attendance calculator - genuinely
// computes and persists, not a placeholder. Uses its own dedicated
// localStorage keys rather than reusing Syllabus's own shared subjects
// array (nexus_syllabus_subjects), since that array is a real,
// established cross-component data source Syllabus itself also
// writes to - building a separate, independent list here avoids any
// risk of an unrelated write path silently dropping a new field on
// that shared structure. The one-time cost is a person re-typing
// subject names for this specific calculator; the benefit is zero
// risk to the existing Syllabus <-> StudyPage sync this session's
// prior rounds already built and verified.
import { useState } from 'react';
import { GraduationCap, Percent, Plus, Trash2, TrendingUp } from 'lucide-react';

const CGPA_STORAGE_KEY = 'nexus_study_cgpa_subjects';
const ATTENDANCE_STORAGE_KEY = 'nexus_study_attendance_subjects';

// The real, standard 10-point CGPA scale used across Indian
// universities - matching this app's own existing ₹-currency default
// (confirmed in FinancePage.jsx), the same real regional context.
const GRADE_POINTS = { O: 10, 'A+': 9, A: 8, 'B+': 7, B: 6, C: 5, P: 4, F: 0 };

const readJson = (key, fallback) => {
    try {
        const saved = localStorage.getItem(key);
        if (!saved) return fallback;
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : fallback;
    } catch (e) {
        return fallback;
    }
};

const GpaCalculator = () => {
    const [subTab, setSubTab] = useState('cgpa'); // 'cgpa' | 'attendance'

    // ============================================================
    // CGPA
    // ============================================================
    const [cgpaSubjects, setCgpaSubjects] = useState(() => readJson(CGPA_STORAGE_KEY, []));
    const [newSubjectName, setNewSubjectName] = useState('');
    const [newSubjectCredits, setNewSubjectCredits] = useState('');
    const [newSubjectGrade, setNewSubjectGrade] = useState('A');

    const persistCgpa = (next) => {
        setCgpaSubjects(next);
        localStorage.setItem(CGPA_STORAGE_KEY, JSON.stringify(next));
    };

    const addCgpaSubject = (e) => {
        e.preventDefault();
        if (!newSubjectName.trim() || !newSubjectCredits) return;
        const credits = Number(newSubjectCredits);
        if (!Number.isFinite(credits) || credits <= 0) return;
        persistCgpa([...cgpaSubjects, { id: Date.now(), name: newSubjectName.trim(), credits, grade: newSubjectGrade }]);
        setNewSubjectName('');
        setNewSubjectCredits('');
        setNewSubjectGrade('A');
    };

    const deleteCgpaSubject = (id) => persistCgpa(cgpaSubjects.filter((s) => s.id !== id));

    const totalCredits = cgpaSubjects.reduce((acc, s) => acc + (s.credits || 0), 0);
    const totalGradePoints = cgpaSubjects.reduce((acc, s) => acc + (s.credits || 0) * (GRADE_POINTS[s.grade] ?? 0), 0);
    const cgpa = totalCredits > 0 ? totalGradePoints / totalCredits : 0;

    // ============================================================
    // Attendance
    // ============================================================
    const [attendanceSubjects, setAttendanceSubjects] = useState(() => readJson(ATTENDANCE_STORAGE_KEY, []));
    const [newAttName, setNewAttName] = useState('');
    const [newAttTotal, setNewAttTotal] = useState('');
    const [newAttAttended, setNewAttAttended] = useState('');
    // A real, standard minimum most Indian universities require -
    // genuinely editable, not hardcoded, since the real required
    // threshold varies by institution.
    const [attendanceThreshold, setAttendanceThreshold] = useState(75);

    const persistAttendance = (next) => {
        setAttendanceSubjects(next);
        localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(next));
    };

    const addAttendanceSubject = (e) => {
        e.preventDefault();
        if (!newAttName.trim() || !newAttTotal || !newAttAttended) return;
        const total = Number(newAttTotal);
        const attended = Number(newAttAttended);
        if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(attended) || attended < 0 || attended > total) return;
        persistAttendance([...attendanceSubjects, { id: Date.now(), name: newAttName.trim(), total, attended }]);
        setNewAttName('');
        setNewAttTotal('');
        setNewAttAttended('');
    };

    const deleteAttendanceSubject = (id) => persistAttendance(attendanceSubjects.filter((s) => s.id !== id));

    // Real, genuinely useful helper math, not just a raw percentage:
    // how many more classes must be attended (in a row, with no
    // further absences) to reach the threshold, or how many more
    // classes can genuinely still be skipped while staying at or
    // above it - both derived directly from the real algebra behind
    // "attended / total >= threshold", not an approximation.
    const attendanceInsight = (total, attended, thresholdPercent) => {
        const threshold = thresholdPercent / 100;
        const currentPercent = total > 0 ? (attended / total) * 100 : 0;
        if (currentPercent >= thresholdPercent) {
            // Solve for the largest n such that attended / (total + n) >= threshold
            const maxSkippable = threshold > 0 ? Math.floor(attended / threshold - total) : Infinity;
            return { met: true, currentPercent, value: Math.max(0, maxSkippable) };
        }
        // Solve for the smallest n such that (attended + n) / (total + n) >= threshold
        const denom = 1 - threshold;
        const needed = denom > 0 ? Math.ceil((threshold * total - attended) / denom) : Infinity;
        return { met: false, currentPercent, value: Math.max(0, needed) };
    };

    const tabButtonStyle = (active) => ({
        padding: '10px 16px', background: active ? 'var(--widget-bg)' : 'transparent',
        color: active ? 'var(--primary)' : 'var(--text-secondary)', border: 'none',
        borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
        fontWeight: '600', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap',
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border-premium)', overflowX: 'auto' }}>
                <button onClick={() => setSubTab('cgpa')} style={tabButtonStyle(subTab === 'cgpa')}>CGPA Calculator</button>
                <button onClick={() => setSubTab('attendance')} style={tabButtonStyle(subTab === 'attendance')}>Attendance Tracker</button>
            </div>

            {subTab === 'cgpa' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: '28px', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: 'var(--premium-shadow)' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--widget-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <GraduationCap size={30} color="var(--primary)" />
                        </div>
                        <div>
                            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cumulative GPA</span>
                            <h2 style={{ fontSize: '36px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: '1.1' }}>{cgpa.toFixed(2)}<span style={{ fontSize: '16px', color: 'var(--text-muted)', fontWeight: '600' }}> / 10</span></h2>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{totalCredits} total credits across {cgpaSubjects.length} subject{cgpaSubjects.length === 1 ? '' : 's'}</span>
                        </div>
                    </div>

                    <form onSubmit={addCgpaSubject} style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: '20px' }}>
                        <input type="text" placeholder="Subject name" aria-label="Subject name" value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} style={{ flex: '2 1 180px', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                        <input type="number" min="1" placeholder="Credits" aria-label="Credits" value={newSubjectCredits} onChange={(e) => setNewSubjectCredits(e.target.value)} style={{ flex: '1 1 100px', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                        <select value={newSubjectGrade} onChange={(e) => setNewSubjectGrade(e.target.value)} aria-label="Grade" style={{ flex: '1 1 100px', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', cursor: 'pointer' }}>
                            {Object.keys(GRADE_POINTS).map((g) => <option key={g} value={g} style={{ background: 'var(--surface-inset)' }}>{g} ({GRADE_POINTS[g]})</option>)}
                        </select>
                        <button type="submit" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', flexShrink: 0 }}><Plus size={15} /> Add</button>
                    </form>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {cgpaSubjects.length === 0 ? (
                            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-surface)', borderRadius: '16px', border: '1px dashed var(--border-premium)', fontSize: '13px' }}>
                                Add a subject above to calculate your CGPA.
                            </div>
                        ) : cgpaSubjects.map((s) => (
                            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', background: 'var(--widget-bg)', padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--border-premium)' }}>
                                <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', minWidth: 0, overflowWrap: 'break-word' }}>{s.name}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.credits} cr</span>
                                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary)', padding: '3px 8px', background: 'var(--surface-inset)', borderRadius: '6px' }}>{s.grade}</span>
                                    <button onClick={() => deleteCgpaSubject(s.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Trash2 size={15} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {subTab === 'attendance' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '14px', padding: '14px 18px' }}>
                        <Percent size={16} color="var(--primary)" />
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Required attendance:</span>
                        <input type="number" min="1" max="100" value={attendanceThreshold} onChange={(e) => setAttendanceThreshold(Math.min(100, Math.max(1, Number(e.target.value) || 0)))} aria-label="Required attendance percentage" style={{ width: '60px', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>%</span>
                    </div>

                    <form onSubmit={addAttendanceSubject} style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: '20px' }}>
                        <input type="text" placeholder="Subject name" aria-label="Subject name" value={newAttName} onChange={(e) => setNewAttName(e.target.value)} style={{ flex: '2 1 180px', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                        <input type="number" min="1" placeholder="Total classes" aria-label="Total classes" value={newAttTotal} onChange={(e) => setNewAttTotal(e.target.value)} style={{ flex: '1 1 120px', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                        <input type="number" min="0" placeholder="Classes attended" aria-label="Classes attended" value={newAttAttended} onChange={(e) => setNewAttAttended(e.target.value)} style={{ flex: '1 1 130px', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-premium)', background: 'var(--widget-bg)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                        <button type="submit" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 18px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', flexShrink: 0 }}><Plus size={15} /> Add</button>
                    </form>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                        {attendanceSubjects.length === 0 ? (
                            <div style={{ gridColumn: '1 / -1', padding: '30px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-surface)', borderRadius: '16px', border: '1px dashed var(--border-premium)', fontSize: '13px' }}>
                                Add a subject above to track attendance.
                            </div>
                        ) : attendanceSubjects.map((s) => {
                            const insight = attendanceInsight(s.total, s.attended, attendanceThreshold);
                            return (
                                <div key={s.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: 'var(--premium-shadow)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                                        <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', minWidth: 0, overflowWrap: 'break-word' }}>{s.name}</span>
                                        <button onClick={() => deleteAttendanceSubject(s.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}><Trash2 size={15} /></button>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                        <span style={{ fontSize: '28px', fontWeight: '800', color: insight.met ? '#10B981' : '#EF4444' }}>{insight.currentPercent.toFixed(1)}%</span>
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>({s.attended}/{s.total})</span>
                                    </div>
                                    <div style={{ width: '100%', height: '6px', background: 'var(--surface-inset)', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{ width: `${Math.min(100, insight.currentPercent)}%`, height: '100%', background: insight.met ? '#10B981' : '#EF4444', borderRadius: '3px' }} />
                                    </div>
                                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <TrendingUp size={13} />
                                        {insight.met
                                            ? (insight.value > 0 ? `Can skip ${insight.value} more class${insight.value === 1 ? '' : 'es'} and stay at ${attendanceThreshold}%+` : `At the edge of ${attendanceThreshold}% - one more miss drops you below`)
                                            : `Attend the next ${insight.value} class${insight.value === 1 ? '' : 'es'} in a row to reach ${attendanceThreshold}%`}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default GpaCalculator;
