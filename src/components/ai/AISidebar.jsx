// src/components/ai/AISidebar.jsx
//
// The collapsible chat-history sidebar for the redesigned AI Chat
// section. Purely presentational - the real coach/session state (which
// is active, the session list, the current drag-resized width) AND
// whether the Voice Assistant panel is showing are all owned by
// AILayout.jsx and passed down as props; this component only calls the
// on* callbacks it's given. showVoicePanel used to be local state here,
// but that meant it could only ever change what THIS sidebar showed -
// AILayout needs the same flag too, so it can swap the main content area
// (see AIVoiceAssistantView.jsx) instead of leaving the previous chat
// conversation sitting there unrelated to whatever the sidebar is
// showing.
//
// Layout order (expanded view): New Chat -> Chat History -> Voice
// Assistant -> "This Chat" (coach picker, provider/model, Live Context,
// Clear Chat) - matching a real, direct comparison against ChatGPT's own
// sidebar, whose main nav is New chat immediately followed by its flat
// chat history, with no persona/GPT list or per-chat tools wedged in
// between. The old always-expanded "Specialized AI Coaches" block (5
// permanent buttons) is gone for the same reason - ChatGPT never keeps a
// persona list open inline in its main nav either - coach-switching now
// lives in "This Chat" as one compact picker instead.
import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, MessageSquare, Trash2, Mic, ArrowLeft, ShieldCheck, ChevronDown, Check, Bot, Search, Settings2 } from 'lucide-react';
import VoiceStatusPanel from './VoiceStatusPanel.jsx';
import SidebarToggleIcon from '../SidebarToggleIcon.jsx';

// Real brand color per provider - the exact same recipe ProfilePage.jsx's
// own Connections widget uses, so this app never shows two different
// colors for "Gemini" in two different places. 'local' is deliberately
// excluded from this map (and from PROVIDER_STATUS_ORDER below) - it's
// this app's own offline fallback, not a real external connection with
// a "connected/not connected" state worth reporting on.
const PROVIDER_BRAND_COLOR = { gemini: '#4285F4', openai: '#10A37F', grok: '#F97316', deepseek: '#4D6BFE' };
const PROVIDER_STATUS_ORDER = ['gemini', 'openai', 'grok', 'deepseek'];

const AISidebar = ({
    isOpen, isCollapsed, isMobile, width, onClose, onToggleCollapse,
    coaches, selectedCoachId, onSelectCoach,
    sessions, activeSessionId, onSelectSession, onNewChat, onDeleteSession,
    showVoicePanel, onShowVoicePanel, onHideVoicePanel,
    // "This Chat" section (bottom of the expanded view, below Chat
    // History) - the provider/model switcher, Live Context, and Clear
    // Chat. These used to live crammed into AIChatArea.jsx's own header,
    // a real reported clutter problem next to a genuine Gemini chat's
    // near-empty header. The Read Aloud Play/Pause control that used to
    // sit here too has since moved to AIChatArea.jsx's own header
    // instead (see AILayout.jsx) - per a real, direct comparison against
    // Gemini's own chat page, that control isn't a permanent sidebar
    // fixture there either, it only appears once a reading is actually
    // in progress.
    providers, activeProviderId, onSelectProvider, onSelectModel,
    liveContext, onClearChat,
    // Real "open Settings > AI & Learning" shortcut - undefined (and the
    // button below simply doesn't render) if a caller doesn't wire real
    // navigation through, rather than a dead button that looks clickable
    // but does nothing.
    onOpenSettings,
}) => {
    // Real, live search over the actual session titles - only rendered/
    // useful once there's more than a handful of chats to scroll through
    // (see the real, empty-vs-populated guard below), not a decorative
    // input that does nothing on a fresh account with one "New Chat".
    const [historySearch, setHistorySearch] = useState('');
    const sortedSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
    const visibleSessions = historySearch.trim()
        ? sortedSessions.filter((s) => (s.title || '').toLowerCase().includes(historySearch.trim().toLowerCase()))
        : sortedSessions;
    // Real, reported bug this whole trio fixes: these three popovers used
    // to live in AIChatArea.jsx's own wide header (position:absolute,
    // anchored to their own trigger's corner) - now that they open from
    // inside this sidebar's own much narrower column, that same static
    // anchor mostly rendered off the sidebar's own left edge and got
    // clipped there, reading as cut-off/truncated text. Each is now
    // portaled straight to document.body with a real, computed
    // top/left (see the open*Picker helpers below) - position:fixed on
    // the popover itself, set via getBoundingClientRect() on the actual
    // trigger button, the exact same pattern GreetingCard.jsx's own
    // portaled icon pickers already use - so it can never be clipped by
    // this (or any future) narrow container again. A plain full-
    // viewport, invisible backdrop rendered just before each popover in
    // its own portal (also GreetingCard.jsx's established pattern)
    // replaces the old ref-based "was the click outside this box"
    // listener - simpler, and correct regardless of where in the DOM
    // the portaled content actually lives.
    const [modelPickerOpen, setModelPickerOpen] = useState(false);
    const [contextOpen, setContextOpen] = useState(false);
    const [coachPickerOpen, setCoachPickerOpen] = useState(false);
    const [modelPickerPosition, setModelPickerPosition] = useState({ top: 0, left: 0 });
    const [contextPopoverPosition, setContextPopoverPosition] = useState({ top: 0, left: 0 });
    const [coachPickerPosition, setCoachPickerPosition] = useState({ top: 0, left: 0 });
    const modelPickerRef = useRef(null);
    const contextPopoverRef = useRef(null);
    const coachPickerRef = useRef(null);

    // Anchors a popover just below its own trigger, clamped so a wide
    // popover (240px) can never overflow past the real right edge of the
    // viewport even when the trigger itself sits close to it.
    const positionBelow = (ref, popoverWidth) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return { top: 0, left: 0 };
        return {
            top: rect.bottom + 8,
            left: Math.min(rect.left, window.innerWidth - popoverWidth - 16),
        };
    };
    const openModelPicker = () => { setModelPickerPosition(positionBelow(modelPickerRef, 220)); setModelPickerOpen((v) => !v); };
    const openContextPopover = () => { setContextPopoverPosition(positionBelow(contextPopoverRef, 240)); setContextOpen((v) => !v); };
    const openCoachPicker = () => { setCoachPickerPosition(positionBelow(coachPickerRef, 220)); setCoachPickerOpen((v) => !v); };

    // The coach actually driving THIS conversation - the compact picker
    // below shows this instead of the old, always-expanded "Specialized
    // AI Coaches" list, per a real, direct comparison against ChatGPT's
    // own sidebar: it never shows a permanent persona/GPT list inline in
    // its main nav either, so that big always-visible block is gone -
    // switching still works, just from one compact control instead.
    const activeCoach = coaches.find((c) => c.id === selectedCoachId) || coaches[0];
    const ActiveCoachIcon = activeCoach?.icon || Bot;

    // Only genuinely-connected providers render at all - a "Not
    // Connected" pill for a key the user never confirmed isn't real
    // status, it's a placeholder ad for a provider they haven't set up
    // (same reasoning already applied to Settings' own Connected Accounts
    // list).
    const readyProviders = providers.filter((p) => p.ready);

    const sidebarClassName = [
        'ai-sidebar',
        isCollapsed && !isMobile ? 'is-collapsed' : '',
        isMobile && isOpen ? 'is-open' : '',
    ].filter(Boolean).join(' ');

    return (
        <>
            {isMobile && (
                <div
                    className={`ai-sidebar-backdrop${isOpen ? ' is-visible' : ''}`}
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}

            <aside className={sidebarClassName} style={{ '--ai-sidebar-width': `${width}px` }} aria-label="AI coaches and chat history">
                {/* Icon-only rail - only ever visible while collapsed on
                    desktop (see the .is-collapsed CSS rules); mobile never
                    renders in a collapsed state, it's just open/closed. The
                    toggle here sits FIRST, directly above "+" New Chat, so
                    expanding the rail is the same single, obvious control
                    the expanded sidebar's own toggle-above-New-Chat row
                    uses below. */}
                <div className="ai-sidebar-rail" aria-hidden={!isCollapsed || isMobile}>
                    <button type="button" className="ai-rail-icon-btn" title="Expand sidebar" onClick={onToggleCollapse}>
                        <SidebarToggleIcon isOpen={false} size={18} />
                    </button>
                    <button type="button" className="ai-rail-icon-btn is-primary" title="New chat" onClick={onNewChat}>
                        <Plus size={18} />
                    </button>
                    {coaches.map((coach) => {
                        const CoachIcon = coach.icon;
                        const isActive = selectedCoachId === coach.id;
                        return (
                            <button
                                key={coach.id} type="button" title={coach.label}
                                className="ai-rail-icon-btn"
                                style={isActive ? { background: 'var(--widget-bg)', borderColor: coach.accent, color: coach.accent } : undefined}
                                onClick={() => onSelectCoach(coach.id)}
                            >
                                <CoachIcon size={17} />
                            </button>
                        );
                    })}
                    <button
                        type="button" title="Voice Assistant" className="ai-rail-icon-btn"
                        style={showVoicePanel ? { background: 'var(--widget-bg)', borderColor: 'var(--primary)', color: 'var(--primary)' } : undefined}
                        onClick={onShowVoicePanel}
                    >
                        <Mic size={17} />
                    </button>
                </div>

                <div className="ai-sidebar-inner">
                    {/* Hamburger sits directly above "+ New Chat" - the
                        requested "logical, clean visual sequence". On
                        desktop it collapses the sidebar to the icon rail;
                        on mobile (no rail state) the exact same toggle
                        closes the open drawer, so a tap here always does
                        the obvious, expected thing regardless of viewport. */}
                    <button type="button" className="ai-sidebar-toggle-btn" onClick={onToggleCollapse} title={isMobile ? 'Close sidebar' : 'Collapse sidebar'} aria-label="Toggle sidebar">
                        <SidebarToggleIcon isOpen size={18} />
                        <span className="ai-sidebar-title">Nexus AI</span>
                    </button>

                    {showVoicePanel ? (
                        <>
                            {/* A real "page" swap inside the same sidebar
                                shell, not a new route/modal - the Coaches
                                and Chat History content below is simply not
                                rendered while this is showing, and comes
                                straight back once Back is pressed. */}
                            <button type="button" className="ai-new-chat-btn" onClick={onHideVoicePanel}>
                                <ArrowLeft size={16} /> Back
                            </button>
                            <span className="ai-sidebar-section-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Mic size={12} /> Voice Status
                            </span>
                            {/* Not the full settings form - that's already
                                showing right now in the main content area
                                (see AILayout.jsx swapping in
                                AIVoiceAssistantView.jsx on this same flag).
                                This is the live status + Stop control that
                                form doesn't have - see VoiceStatusPanel.jsx. */}
                            <div style={{ padding: '2px 2px 12px', overflowY: 'auto' }}>
                                <VoiceStatusPanel />
                            </div>
                        </>
                    ) : (
                        <>
                            <button type="button" className="ai-new-chat-btn" onClick={onNewChat}>
                                <Plus size={16} /> New Chat
                            </button>

                            {/* Chat History sits right under New Chat now -
                                matching a real, direct comparison against
                                ChatGPT's own sidebar (New chat, then its
                                flat "Chats" history, immediately - no
                                persona list wedged in between). */}
                            <span className="ai-sidebar-section-label">Chat History</span>
                            {/* Real, live filter over actual session titles -
                                only shown once there's genuinely enough
                                history to need searching (a bare input
                                above a single fresh "New Chat" entry is
                                dead weight, not a real convenience). */}
                            {sortedSessions.length > 4 && (
                                <div className="ai-sidebar-search">
                                    <Search size={13} color="var(--text-muted)" />
                                    <input
                                        type="text" value={historySearch}
                                        onChange={(e) => setHistorySearch(e.target.value)}
                                        placeholder="Search chats" aria-label="Search chat history"
                                    />
                                </div>
                            )}
                            <div className="ai-history-list">
                                {visibleSessions.length === 0 ? (
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 6px' }}>
                                        No chats match &quot;{historySearch}&quot;
                                    </span>
                                ) : visibleSessions.map((session) => {
                                    const isActive = session.id === activeSessionId;
                                    return (
                                        <div
                                            key={session.id}
                                            className={`ai-history-item${isActive ? ' is-active' : ''}`}
                                            onClick={() => onSelectSession(session.id)}
                                            title={session.title}
                                        >
                                            <span className="ai-history-item-icon">
                                                <MessageSquare size={13} color={isActive ? 'var(--primary)' : 'var(--text-muted)'} />
                                            </span>
                                            <span className="ai-history-item-title">{session.title}</span>
                                            <button
                                                type="button" className="ai-history-delete-btn" title="Delete chat" aria-label="Delete chat"
                                                onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="ai-sidebar-divider" />

                            {/* Voice Assistant moved down here, just above
                                "This Chat" - no longer a top-level item
                                competing with New Chat/History for the
                                first thing you see. */}
                            <button
                                type="button" className="ai-coach-item"
                                style={{ '--ai-coach-accent': 'var(--primary)' }}
                                onClick={onShowVoicePanel}
                                title="Voice Assistant"
                            >
                                <span className="ai-coach-item-icon"><Mic size={15} /></span>
                                <span className="ai-coach-item-label">Voice Assistant</span>
                            </button>

                            <div className="ai-sidebar-divider" />

                            {/* Connections - real, live status for every AI
                                provider this app supports, straight from
                                the same `providers` array "This Chat"'s own
                                switcher below reads (each one's `ready` is
                                the real settings.<provider>ApiKeyConfirmed
                                flag from Settings > AI & Learning, see
                                AIPage.jsx). Deliberately a DIFFERENT thing
                                from that switcher: this shows all 4, not
                                just the ready ones, specifically so a
                                provider that still needs setup is visible
                                here too - not silently missing. 'local' is
                                left out, same reasoning as everywhere else
                                in this app: it's this app's own offline
                                fallback, not a real external connection. */}
                            <span className="ai-sidebar-section-label">Connections</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '0 2px 4px' }}>
                                {PROVIDER_STATUS_ORDER.map((id) => {
                                    const p = providers.find((prov) => prov.id === id);
                                    const connected = !!p?.ready;
                                    const color = PROVIDER_BRAND_COLOR[id];
                                    return (
                                        <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '7px 8px', minWidth: 0 }}>
                                            <span style={{
                                                width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
                                                background: connected ? color : 'var(--text-muted)',
                                                boxShadow: connected ? `0 0 6px ${color}` : 'none',
                                            }} />
                                            <span style={{ fontSize: '12px', fontWeight: '600', color: connected ? 'var(--text-primary)' : 'var(--text-muted)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {p?.label || id}
                                            </span>
                                            <span style={{ fontSize: '10px', fontWeight: '700', color: connected ? color : 'var(--text-muted)', flexShrink: 0 }}>
                                                {connected ? 'Connected' : 'Not Connected'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="ai-sidebar-divider" />

                            {/* "This Chat" - which coach is answering, the
                                provider/model switcher, Live Context, and
                                Clear Chat. The old "Specialized AI Coaches"
                                block - a permanent, always-expanded list of
                                5 buttons - is gone; a real, direct
                                comparison against ChatGPT's own sidebar
                                showed it never keeps a persona/GPT list
                                sitting open in the main nav like that
                                either, so coach-switching now lives here as
                                one compact picker instead, the same shape
                                as the provider pill next to it. */}
                            <span className="ai-sidebar-section-label">This Chat</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 2px 4px' }}>
                                <div style={{ position: 'relative' }} ref={coachPickerRef}>
                                    <button
                                        type="button" className="ai-coach-item" onClick={openCoachPicker}
                                        title="Switch AI coach" aria-label="Switch AI coach" aria-expanded={coachPickerOpen}
                                    >
                                        <span className="ai-coach-item-icon" style={{ color: activeCoach?.accent }}><ActiveCoachIcon size={15} /></span>
                                        <span className="ai-coach-item-label">{activeCoach?.label || 'General OS Assistant'}</span>
                                        <ChevronDown size={13} style={{ marginLeft: 'auto', flexShrink: 0, transform: coachPickerOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s ease' }} />
                                    </button>
                                    {coachPickerOpen && createPortal(
                                        <>
                                            <div onClick={() => setCoachPickerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999 }} />
                                            <div className="ai-model-picker-popover" style={{ top: coachPickerPosition.top, left: coachPickerPosition.left }}>
                                                {coaches.map((coach) => {
                                                    const CoachIcon = coach.icon;
                                                    const isActive = selectedCoachId === coach.id;
                                                    return (
                                                        <button
                                                            key={coach.id} type="button"
                                                            className={`ai-model-picker-item${isActive ? ' is-selected' : ''}`}
                                                            onClick={() => { onSelectCoach(coach.id); setCoachPickerOpen(false); }}
                                                        >
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CoachIcon size={14} color={coach.accent} /> {coach.label}</span>
                                                            {isActive && <Check size={13} />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </>,
                                        document.body,
                                    )}
                                </div>

                                {readyProviders.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {readyProviders.map((p) => {
                                            const isActive = activeProviderId === p.id;
                                            const hasModels = isActive && p.models && p.models.length > 0;
                                            const activeModelLabel = p.selectedModel || p.models?.[0];
                                            return (
                                                <div
                                                    key={p.id}
                                                    className={`ai-provider-pill-group is-ready${isActive ? ' is-active' : ''}`}
                                                    ref={isActive ? modelPickerRef : undefined}
                                                >
                                                    <button
                                                        type="button"
                                                        className="ai-provider-pill-btn"
                                                        onClick={() => onSelectProvider(p.id)}
                                                        title={
                                                            p.id === 'local'
                                                                ? (isActive ? 'Answering locally from your real Nexus data - no live AI model is used.' : 'Switch to local answers only - turns off every live AI model for this conversation.')
                                                                : isActive ? `Live via ${p.label} - the model actually answering this conversation.` : `Click to switch this conversation to ${p.label}.`
                                                        }
                                                    >
                                                        <span className="ai-provider-pill-dot" /> {p.label}
                                                    </button>
                                                    {hasModels && (
                                                        <button
                                                            type="button"
                                                            className={`ai-model-picker-btn${modelPickerOpen ? ' is-open' : ''}`}
                                                            onClick={openModelPicker}
                                                            title={`Pick which ${p.label} model to use (currently ${activeModelLabel})`}
                                                            aria-label="Choose model" aria-expanded={modelPickerOpen}
                                                        >
                                                            <ChevronDown size={13} />
                                                        </button>
                                                    )}
                                                    {hasModels && modelPickerOpen && createPortal(
                                                        <>
                                                            <div onClick={() => setModelPickerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999 }} />
                                                            <div className="ai-model-picker-popover" style={{ top: modelPickerPosition.top, left: modelPickerPosition.left }}>
                                                                {p.models.map((modelId) => (
                                                                    <button
                                                                        key={modelId} type="button"
                                                                        className={`ai-model-picker-item${modelId === activeModelLabel ? ' is-selected' : ''}`}
                                                                        onClick={() => { onSelectModel(p.id, modelId); setModelPickerOpen(false); }}
                                                                    >
                                                                        {modelId}
                                                                        {modelId === activeModelLabel && <Check size={13} />}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </>,
                                                        document.body,
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                <div style={{ position: 'relative' }} ref={contextPopoverRef}>
                                    <button
                                        type="button" className="ai-coach-item" onClick={openContextPopover}
                                        title="Live Context" aria-label="Show live context" aria-expanded={contextOpen}
                                    >
                                        <span className="ai-coach-item-icon"><ShieldCheck size={15} /></span>
                                        <span className="ai-coach-item-label">Live Context</span>
                                    </button>
                                    {contextOpen && createPortal(
                                        <>
                                            <div onClick={() => setContextOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999 }} />
                                            <div className="ai-context-popover" style={{ top: contextPopoverPosition.top, left: contextPopoverPosition.left }}>
                                                <span className="ai-context-popover-title"><ShieldCheck size={14} color="#10B981" /> Live Context</span>
                                                {liveContext.map((ctx) => (
                                                    <div key={ctx.label} className="ai-context-card">
                                                        <span className="ai-context-card-label" title={ctx.label}><ctx.icon size={12} color="var(--accent)" /> {ctx.label}</span>
                                                        <span className="ai-context-card-value" title={ctx.value}>{ctx.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>,
                                        document.body,
                                    )}
                                </div>

                                <button type="button" className="ai-coach-item" onClick={onClearChat} title="Clear this chat">
                                    <span className="ai-coach-item-icon"><Trash2 size={15} /></span>
                                    <span className="ai-coach-item-label">Clear This Chat</span>
                                </button>
                            </div>

                            {/* Direct shortcut into Settings > AI & Learning
                                API Integrations, so adding/fixing a
                                provider's key doesn't mean leaving this
                                page and hunting for it - only rendered
                                when a caller actually wired real
                                navigation through (see onOpenSettings on
                                AIPage.jsx/AILayout.jsx), never a dead
                                button that looks clickable but isn't. */}
                            {onOpenSettings && (
                                <>
                                    <div className="ai-sidebar-divider" />
                                    <button type="button" className="ai-coach-item" onClick={onOpenSettings} title="Open Settings > AI & Learning API Integrations">
                                        <span className="ai-coach-item-icon"><Settings2 size={15} /></span>
                                        <span className="ai-coach-item-label">Manage AI Providers</span>
                                    </button>
                                </>
                            )}
                        </>
                    )}
                </div>
            </aside>
        </>
    );
};

export default AISidebar;
