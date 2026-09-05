// src/components/ai/AILayout.jsx
//
// Parent layout for the redesigned, Gemini-inspired AI Chat section -
// a flex row of AISidebar (left) + a draggable resizer + AIChatArea
// (right), filling 100% of the space AIPage.jsx's own wrapper gives it.
//
// Per the request: owns `isSidebarOpen` via useState here, since it's
// genuinely local, presentational UI state with no reason to live
// higher up. `selectedCoach` is deliberately NOT separate local state
// here, though - it's received as a controlled prop (selectedCoachId +
// onSelectCoach) from AIPage.jsx instead, because picking a coach there
// does real work beyond a visual selection: it switches which system
// prompt/persona the live Gemini/ChatGPT call and local-engine fallback
// actually use for the next message. Keeping AIPage.jsx as the single
// source of truth for that avoids two independent, driftable copies of
// "which coach is active".
//
// height:100% is correct (not a hand-computed calc()) because
// DashboardLayout.jsx now gives the AI tab's own slot a real, plain
// flex:1/minHeight:0 parent with zero padding around it - see that
// file's isAIFullBleed branch - so this component genuinely owns 100%
// of the real remaining space, flush against the OS sidebar and header,
// with no page-level scroll (only the message list scrolls internally).
import { useState, useEffect } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { useResizableSidebar } from '../../hooks/useResizableSidebar.js';
import { speakMessageText, pauseSpeaking, resumeSpeaking, cancelSpeaking } from '../../utils/chatSpeech.js';
import TourGuide from '../TourGuide.jsx';
import { TOUR_STEPS } from '../../constants/tourSteps.js';
import AISidebar from './AISidebar.jsx';
import AIChatArea from './AIChatArea.jsx';
import AIVoiceAssistantView from './AIVoiceAssistantView.jsx';

const AILayout = ({
    coaches, selectedCoachId, onSelectCoach,
    sessions, activeSessionId, onSelectSession, onNewChat, onDeleteSession,
    messages, isGenerating, inputPrompt, onInputChange, onSubmit,
    providers, activeProviderId, onSelectProvider, onSelectModel,
    pendingImage, onAttachImage,
    liveContext, onClearChat,
    onRegenerateMessage, onBranchChat, onToggleMessageLike,
    showClearConfirm, onCancelClear, onConfirmClear,
    showTour, onFinishTour,
    onOpenSettings,
}) => {
    const isMobile = useIsMobile();
    // Closed by default on every viewport now, per explicit request - it
    // used to default open on desktop (!isMobile), but opening the AI
    // section should start on the clean chat view every time, not with
    // the coach/history sidebar already taking up space uninvited.
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    // Lifted up from AISidebar's own local state - a real, reported bug
    // was that toggling this only ever changed what the SIDEBAR showed,
    // leaving the previous chat conversation still fully visible in the
    // main pane right next to it. Owning it here lets it also decide
    // what AIChatArea's own slot renders below.
    const [showVoicePanel, setShowVoicePanel] = useState(false);
    const { width: sidebarWidth, isDragging, handleMouseDown } = useResizableSidebar();

    // Single source of truth for Read Aloud - shared by every message's
    // own "Read aloud" menu item AND the header's own Play/Pause control
    // (both rendered inside AIChatArea.jsx - see that file) - lifted up
    // here, one level above, so the two can never disagree about what's
    // currently playing. speakingMessageId === null means nothing is
    // loaded and the header control stays hidden entirely (it only
    // appears once some message's "Read aloud" has actually been
    // clicked, matching a real, direct comparison against Gemini's own
    // chat page, where that control isn't a permanent fixture either).
    // isSpeechPaused only matters while speakingMessageId is set.
    const [speakingMessageId, setSpeakingMessageId] = useState(null);
    const [isSpeechPaused, setIsSpeechPaused] = useState(false);
    // Real pause/resume, not cancel-and-replay - a real, reported bug was
    // that pressing Play again after pausing always restarted the
    // reading from the very beginning instead of continuing from where
    // it left off. Clicking the SAME message's control now pauses/
    // resumes speechSynthesis in place; picking a DIFFERENT message
    // cancels whatever was playing/paused and starts that one fresh.
    const toggleSpeakMessage = (id, text) => {
        if (speakingMessageId === id) {
            if (isSpeechPaused) { resumeSpeaking(); setIsSpeechPaused(false); }
            else { pauseSpeaking(); setIsSpeechPaused(true); }
            return;
        }
        setSpeakingMessageId(id);
        setIsSpeechPaused(false);
        speakMessageText(text, () => {
            setSpeakingMessageId((cur) => (cur === id ? null : cur));
            setIsSpeechPaused(false);
        });
    };

    // Stops any in-flight Read Aloud speech the instant this whole AI
    // section unmounts (navigating to a different tab) - same real
    // cleanup the Daily Briefing card already does for its own speech, so
    // the voice never keeps talking after the screen that started it is
    // gone.
    useEffect(() => {
        return () => cancelSpeaking();
    }, []);

    const isCollapsed = !isSidebarOpen;

    const handleSelectCoach = (coachId) => {
        onSelectCoach(coachId);
        setShowVoicePanel(false);
        if (isMobile) setIsSidebarOpen(false);
    };

    const toggleSidebar = () => setIsSidebarOpen((v) => !v);

    // The Voice Assistant panel is an unrelated context (AI Daily
    // Briefing settings, not this conversation) - stopping any Read Aloud
    // in progress before swapping to it avoids a chat response quietly
    // still talking underneath an unrelated settings screen.
    const showVoiceAssistantPanel = () => {
        cancelSpeaking();
        setSpeakingMessageId(null);
        setIsSpeechPaused(false);
        setShowVoicePanel(true);
    };

    return (
        <div className={`ai-layout${isDragging ? ' is-resizing' : ''}`}>
            {showTour && <TourGuide tourId="ai" steps={TOUR_STEPS.ai} onFinish={onFinishTour} />}

            <AISidebar
                isOpen={isSidebarOpen}
                isCollapsed={isCollapsed}
                isMobile={isMobile}
                width={sidebarWidth}
                onClose={() => setIsSidebarOpen(false)}
                onToggleCollapse={toggleSidebar}
                coaches={coaches}
                selectedCoachId={selectedCoachId}
                onSelectCoach={handleSelectCoach}
                sessions={sessions}
                activeSessionId={activeSessionId}
                onSelectSession={(id) => { onSelectSession(id); setShowVoicePanel(false); if (isMobile) setIsSidebarOpen(false); }}
                onNewChat={() => { onNewChat(); setShowVoicePanel(false); if (isMobile) setIsSidebarOpen(false); }}
                onDeleteSession={onDeleteSession}
                showVoicePanel={showVoicePanel}
                onShowVoicePanel={showVoiceAssistantPanel}
                onHideVoicePanel={() => setShowVoicePanel(false)}
                providers={providers}
                activeProviderId={activeProviderId}
                onSelectProvider={onSelectProvider}
                onSelectModel={onSelectModel}
                liveContext={liveContext}
                onClearChat={onClearChat}
                onOpenSettings={onOpenSettings}
            />

            {/* Draggable divider - desktop only, and only meaningful while
                the sidebar is actually expanded (dragging a 64px icon rail
                wider makes no sense, and mobile's sidebar is an off-canvas
                overlay with no persistent width to drag at all). */}
            {!isMobile && !isCollapsed && (
                <div
                    className={`ai-resizer${isDragging ? ' is-dragging' : ''}`}
                    onMouseDown={handleMouseDown}
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize AI sidebar"
                    title="Drag to resize"
                />
            )}

            {showVoicePanel ? (
                <AIVoiceAssistantView isSidebarOpen={isSidebarOpen} onToggleSidebar={toggleSidebar} />
            ) : (
                <AIChatArea
                    isSidebarOpen={isSidebarOpen}
                    onToggleSidebar={toggleSidebar}
                    activeSessionId={activeSessionId}
                    messages={messages}
                    isGenerating={isGenerating}
                    inputPrompt={inputPrompt}
                    onInputChange={onInputChange}
                    onSubmit={onSubmit}
                    activeProviderId={activeProviderId}
                    pendingImage={pendingImage}
                    onAttachImage={onAttachImage}
                    speakingMessageId={speakingMessageId}
                    isSpeechPaused={isSpeechPaused}
                    onToggleSpeak={toggleSpeakMessage}
                    onRegenerateMessage={onRegenerateMessage}
                    onBranchChat={onBranchChat}
                    onToggleMessageLike={onToggleMessageLike}
                />
            )}

            {showClearConfirm && (
                <div className="ai-modal-overlay" onClick={onCancelClear}>
                    <div className="ai-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="ai-modal-title">
                            <h3>Clear AI Chat?</h3>
                            <span>This permanently erases this conversation.</span>
                        </div>
                        <div className="ai-modal-actions">
                            <button type="button" className="ai-modal-btn" onClick={onCancelClear}>Cancel</button>
                            <button type="button" className="ai-modal-btn is-danger" onClick={onConfirmClear}>Confirm</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AILayout;
