// src/components/ai/AIVoiceAssistantView.jsx
//
// A real, dedicated main-area view for the AI page's "Voice Assistant"
// entry - replaces AIChatArea entirely while active, rather than only
// swapping the sidebar's own content. A real, reported problem with
// the earlier version: clicking "Voice Assistant" only changed what
// the SIDEBAR showed, leaving the previous chat conversation (with its
// own unrelated messages) still fully visible in the main pane right
// next to it - confusing, and not what "open a page about the voice
// assistant" means. Reuses the exact same ai-chat-header/-area CSS
// classes AIChatArea itself uses, so switching between this and the
// real chat reads as one consistent app, not two different UIs bolted
// together.
import { Mic } from 'lucide-react';
import VoiceAssistantSettings from '../VoiceAssistantSettings.jsx';
import SidebarToggleIcon from '../SidebarToggleIcon.jsx';

const AIVoiceAssistantView = ({ isSidebarOpen, onToggleSidebar }) => (
    <div className="ai-chat-area">
        <header className="ai-chat-header">
            <button
                type="button" className="ai-chat-header-btn ai-chat-header-menu-btn" onClick={onToggleSidebar}
                title={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'} aria-label="Toggle sidebar"
            >
                <SidebarToggleIcon isOpen={isSidebarOpen} size={17} />
            </button>
            <div className="ai-chat-header-title-group">
                <span className="ai-chat-header-title">Voice Assistant</span>
                <span className="ai-chat-header-subtitle">AI Daily Briefing settings</span>
            </div>
        </header>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px 20px' }}>
            <div style={{ maxWidth: '520px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: 'var(--widget-bg)', border: '1px solid var(--border-premium)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Mic size={18} color="var(--accent)" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <h2 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>AI Daily Briefing</h2>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>On/off switch, voice, and language - same controls as Settings &gt; Audio</span>
                    </div>
                </div>
                <VoiceAssistantSettings />
            </div>
        </div>
    </div>
);

export default AIVoiceAssistantView;
