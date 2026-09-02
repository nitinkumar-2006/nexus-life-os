// src/components/ai/AIChatArea.jsx
//
// The Gemini-inspired main chat interface: header (hamburger + centered
// active-coach name), a scrollable, centered-column message log, and a
// bottom-pinned auto-expanding input pill. All real chat state (messages,
// streaming, provider, live context) is owned by AIPage.jsx and passed
// down as props - this component is purely presentational plus the
// input's own local UI concerns (textarea auto-grow, attach/context
// popovers, speech-to-text).
//
// Message markdown/code rendering lives here (moved from AIPage.jsx)
// since it's a rendering concern, not chat state - rewritten to use real
// CSS classes (aiChat.css) instead of the previous inline style objects,
// per this section's "no inline styles" requirement.
import { useState, useRef, useEffect, Fragment } from 'react';
import {
    Send, Mic, Plus, Minus, RefreshCw, Square,
    Copy, Check, FileText, X,
    ThumbsUp, Share2, MoreHorizontal, GitBranch, Code2, Volume2, Play, Pause,
} from 'lucide-react';
import { useSpeechToText } from '../../hooks/useSpeechToText.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import VoiceWaveform from './VoiceWaveform.jsx';
import AttachmentMenu from '../AttachmentMenu.jsx';
import CameraCapture from '../CameraCapture.jsx';

// A real, hand-drawn two-bar icon for the mobile-only header menu
// button below - deliberately NOT a lucide stand-in. A direct, confirmed
// side-by-side comparison against real reference screenshots (ChatGPT's
// own MOBILE header specifically, not its desktop sidebar's own
// box+divider PanelLeft collapse icon, which stays exactly where it was
// - see AISidebar.jsx's own toggle) showed two plain horizontal bars of
// genuinely different lengths, no box or border drawn around them at
// all: the LONGER bar on top, a SHORTER bar beneath it (an earlier pass
// here had this backwards - confirmed live and corrected). Neither
// lucide's Menu (three equal bars) nor PanelLeft (a bordered box with an
// inner divider line) actually matches that shape, so this is drawn by
// hand instead of reaching for the nearest-looking library icon.
const MobileMenuIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <line x1="7" y1="8" x2="19" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="7" y1="16" x2="14" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

// 8MB - generous for a real photo/screenshot or a genuine multi-page PDF
// while staying well clear of the base64-inflated payload becoming an
// unreasonably large request body (base64 itself already adds ~33% on
// top of this).
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

// Real Cmd+/Cmd- style bounds for the chat text zoom control below -
// 0.8x-1.6x in 0.1 steps, persisted so the choice survives a reload
// instead of resetting to default every visit.
const TEXT_SCALE_MIN = 0.8;
const TEXT_SCALE_MAX = 1.6;
const TEXT_SCALE_STEP = 0.1;
const TEXT_SCALE_STORAGE_KEY = 'nexus_ai_chat_text_scale';

const readStoredTextScale = () => {
    try {
        const raw = parseFloat(localStorage.getItem(TEXT_SCALE_STORAGE_KEY));
        return isFinite(raw) && raw >= TEXT_SCALE_MIN && raw <= TEXT_SCALE_MAX ? raw : 1;
    } catch (e) {
        return 1;
    }
};

const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
        // reader.result is "data:image/jpeg;base64,<data>" - only the part
        // after the comma is the real base64 payload Gemini's inline_data
        // field wants (same convention syllabusExtraction.js already uses).
        const commaIndex = reader.result.indexOf(',');
        resolve(commaIndex >= 0 ? reader.result.slice(commaIndex + 1) : reader.result);
    };
    reader.onerror = () => reject(new Error('Could not read this file.'));
    reader.readAsDataURL(file);
});

// ---- Real, lightweight syntax highlighting - no external dependency
// (see AIPage.jsx's original comment; unchanged reasoning, just moved) ----
const LANG_KEYWORDS = {
    java: ['class', 'public', 'private', 'protected', 'static', 'void', 'new', 'return', 'if', 'else', 'for', 'while', 'import', 'package', 'extends', 'implements', 'interface', 'final', 'this', 'super', 'try', 'catch', 'throw', 'throws', 'int', 'boolean', 'String', 'double', 'float', 'long', 'null', 'true', 'false'],
    python: ['def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'import', 'from', 'as', 'try', 'except', 'finally', 'raise', 'with', 'lambda', 'self', 'None', 'True', 'False', 'and', 'or', 'not', 'in', 'is', 'pass', 'break', 'continue'],
    javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'import', 'export', 'from', 'default', 'class', 'extends', 'new', 'this', 'super', 'try', 'catch', 'finally', 'throw', 'async', 'await', 'null', 'undefined', 'true', 'false'],
};
LANG_KEYWORDS.jsx = LANG_KEYWORDS.javascript;
LANG_KEYWORDS.js = LANG_KEYWORDS.javascript;
LANG_KEYWORDS.py = LANG_KEYWORDS.python;

const highlightCode = (code, lang) => {
    const keywords = LANG_KEYWORDS[lang] || LANG_KEYWORDS.javascript;
    const keywordPattern = keywords.join('|');
    const tokenRegex = new RegExp(
        `(\\/\\/.*$|#.*$)|("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*'|\`(?:[^\`\\\\]|\\\\.)*\`)|(\\b\\d+(?:\\.\\d+)?\\b)|(\\b(?:${keywordPattern})\\b)`,
        'gm'
    );
    const nodes = [];
    let lastIndex = 0;
    let match;
    let key = 0;
    while ((match = tokenRegex.exec(code)) !== null) {
        if (match.index > lastIndex) nodes.push(<span key={key++}>{code.slice(lastIndex, match.index)}</span>);
        const [full, comment, string, number, keyword] = match;
        if (comment) nodes.push(<span key={key++} className="ai-code-token-comment">{comment}</span>);
        else if (string) nodes.push(<span key={key++} className="ai-code-token-string">{string}</span>);
        else if (number) nodes.push(<span key={key++} className="ai-code-token-number">{number}</span>);
        else if (keyword) nodes.push(<span key={key++} className="ai-code-token-keyword">{keyword}</span>);
        lastIndex = match.index + full.length;
    }
    if (lastIndex < code.length) nodes.push(<span key={key++}>{code.slice(lastIndex)}</span>);
    return nodes;
};

const CopyCodeButton = ({ code }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch (e) { /* clipboard permission denied - button stays clickable, just doesn't confirm */ }
    };
    return (
        <button type="button" onClick={handleCopy} className={`ai-code-copy-btn${copied ? ' is-copied' : ''}`}>
            {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied!' : 'Copy'}
        </button>
    );
};

const renderInlineMarkdown = (line, keyPrefix) => {
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).filter((p) => p !== '');
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={`${keyPrefix}_${i}`}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('`') && part.endsWith('`')) return <code key={`${keyPrefix}_${i}`} className="ai-msg-inline-code">{part.slice(1, -1)}</code>;
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={`${keyPrefix}_${i}`}>{part.slice(1, -1)}</em>;
        return <Fragment key={`${keyPrefix}_${i}`}>{part}</Fragment>;
    });
};

const renderMarkdownBlock = (text, keyPrefix) => {
    const lines = text.split('\n');
    const blocks = [];
    let listBuffer = [];
    const flushList = (idx) => {
        if (listBuffer.length > 0) {
            blocks.push(<ul key={`${keyPrefix}_list_${idx}`} className="ai-msg-list">{listBuffer}</ul>);
            listBuffer = [];
        }
    };
    lines.forEach((line, idx) => {
        if (/^#{1,3}\s/.test(line)) {
            flushList(idx);
            const level = line.match(/^#+/)[0].length;
            const content = line.replace(/^#{1,3}\s/, '');
            blocks.push(<div key={`${keyPrefix}_h_${idx}`} className={`ai-msg-heading h${level}`}>{renderInlineMarkdown(content, `${keyPrefix}_h_${idx}`)}</div>);
        } else if (/^[-*]\s/.test(line)) {
            listBuffer.push(<li key={`${keyPrefix}_li_${idx}`} className="ai-msg-list-item">{renderInlineMarkdown(line.replace(/^[-*]\s/, ''), `${keyPrefix}_li_${idx}`)}</li>);
        } else if (line.trim() === '') {
            flushList(idx);
        } else {
            flushList(idx);
            blocks.push(<p key={`${keyPrefix}_p_${idx}`} className="ai-msg-paragraph">{renderInlineMarkdown(line, `${keyPrefix}_p_${idx}`)}</p>);
        }
    });
    flushList(lines.length);
    return blocks;
};

const renderMessageText = (text) => {
    if (!text.includes('```')) return <>{renderMarkdownBlock(text, 'md')}</>;
    const parts = text.split('```');
    return parts.map((part, index) => {
        if (index % 2 !== 0) {
            const firstLineBreak = part.indexOf('\n');
            const langTag = firstLineBreak > -1 ? part.slice(0, firstLineBreak).trim().toLowerCase() : '';
            const codeContent = (LANG_KEYWORDS[langTag] || langTag === '') && firstLineBreak > -1 ? part.slice(firstLineBreak + 1) : part;
            const lang = LANG_KEYWORDS[langTag] ? langTag : 'javascript';
            return (
                <div key={index} className="ai-code-block">
                    <div className="ai-code-block-header">
                        <span className="ai-code-lang">{langTag || 'code'}</span>
                        <CopyCodeButton code={codeContent} />
                    </div>
                    <pre className="ai-code-pre"><code>{highlightCode(codeContent, lang)}</code></pre>
                </div>
            );
        }
        return <Fragment key={index}>{renderMarkdownBlock(part, `md_${index}`)}</Fragment>;
    });
};

// A centered, muted date/time divider shown only across a real gap in
// the conversation (5+ minutes since the previous turn), matching a
// direct, explicit comparison against ChatGPT's own pattern - it shows
// a timestamp when a conversation resumes later, not stamped on every
// single bubble. msg.id is this app's own real send-time (Date.now()
// string, see AIPage.jsx's submitMessage/runAIResponse), so the gap is
// computed from real timestamps, not the already-formatted display
// string in msg.time.
const TIME_DIVIDER_GAP_MS = 5 * 60 * 1000;

const shouldShowTimeDivider = (msg, index, messages) => {
    if (index === 0) return true;
    const prevTime = parseInt(messages[index - 1].id, 10);
    const curTime = parseInt(msg.id, 10);
    if (!isFinite(prevTime) || !isFinite(curTime)) return false;
    return curTime - prevTime > TIME_DIVIDER_GAP_MS;
};

// No avatar icons on either side, per explicit request - matches real
// ChatGPT/Gemini, which never puts a bot or person glyph beside a
// message. The only real distinction now is bubble vs plain text (see
// aiChat.css): the user's own message keeps its colored bubble, the
// AI's own response (including an error) is plain flowing text.
//
// The action toolbar (Copy/Like/Share/Retry/More) only ever renders
// under a real, successfully-completed AI response - never under the
// user's own message (matching ChatGPT/Gemini, neither of which puts
// action buttons on your own sent bubble), never under an error bubble
// (there's nothing to copy/like/share/branch from a failure), and Retry
// specifically only on the LAST message in the conversation - the same
// restriction ChatGPT itself applies, since regenerating a response
// buried earlier in the history would either need to silently discard
// every later message or produce two diverging branches from the same
// point, neither of which this single-click control should do quietly.
const MessageBubble = ({ msg, isLastMessage, onRegenerate, onBranch, onToggleLike, speakingMessageId, isSpeechPaused, onToggleSpeak }) => {
    const [copied, setCopied] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [sourceOpen, setSourceOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        if (!menuOpen) return;
        const onOutsideClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
        document.addEventListener('mousedown', onOutsideClick);
        return () => document.removeEventListener('mousedown', onOutsideClick);
    }, [menuOpen]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(msg.text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch (e) { /* clipboard permission denied - button stays clickable, just doesn't confirm */ }
    };

    // Real Web Share API where it exists (mobile browsers, and most
    // desktop browsers over HTTPS) - shares the actual response text
    // through the device's own native share sheet. No backend exists to
    // mint a real shareable link the way ChatGPT's own "Share" does, so
    // where the API isn't available this honestly falls back to copying
    // the text instead of pretending to share it.
    const handleShare = async () => {
        if (navigator.share) {
            try { await navigator.share({ text: msg.text }); } catch (e) { /* user dismissed the share sheet - not an error */ }
        } else {
            handleCopy();
        }
    };

    // id !== 'greeting' - the static per-persona intro line (see
    // AIPage.jsx's getDefaultGreeting) isn't a real generated turn, the
    // same reason it's already excluded from the real chat history sent
    // to any live provider - Copy/Like/Share/Retry/Branch on a canned
    // greeting either does nothing useful (Retry has no prior user turn
    // to regenerate from) or is simply meaningless (Branch would spin
    // off a session containing only the greeting).
    const showActions = msg.sender !== 'user' && !msg.isError && msg.text && msg.id !== 'greeting';
    // A rate-limit/API failure (see AIPage.jsx's isError bubbles) is
    // exactly the case a real "try again" button is most useful for -
    // an explicit, reported pain point was retyping the same prompt by
    // hand after a transient "high demand" error. Standalone, not part
    // of the full toolbar above: Copy/Like/Share/Branch/View-source all
    // make no sense on a message that never actually completed.
    const showErrorRetry = msg.isError && isLastMessage;

    return (
        <div className={`ai-message-row${msg.sender === 'user' ? ' is-user' : ''}`}>
            <div className={`ai-message-bubble${msg.isError ? ' is-error' : msg.sender === 'user' ? ' is-user' : ''}`}>
                {msg.attachmentKind === 'pdf' && (
                    <div className="ai-message-file-chip">
                        <FileText size={16} /> <span>{msg.attachmentName || 'Document.pdf'}</span>
                    </div>
                )}
                {msg.attachmentKind === 'image' && msg.imagePreview && (
                    <img src={msg.imagePreview} alt="Attached" className="ai-message-image" />
                )}
                {renderMessageText(msg.text)}
            </div>

            {showErrorRetry && (
                <div className="ai-message-actions">
                    <button type="button" className="ai-message-action-btn" onClick={() => onRegenerate(msg.id)} title="Try again" aria-label="Try sending this again">
                        <RefreshCw size={14} /> <span style={{ fontSize: '12px', marginLeft: '4px' }}>Try again</span>
                    </button>
                </div>
            )}

            {showActions && (
                <div className="ai-message-actions">
                    <button type="button" className="ai-message-action-btn" onClick={handleCopy} title="Copy" aria-label="Copy response">
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                    <button
                        type="button" className={`ai-message-action-btn${msg.liked ? ' is-active' : ''}`}
                        onClick={() => onToggleLike(msg.id)} title="Good response" aria-label="Mark as a good response"
                    >
                        <ThumbsUp size={14} />
                    </button>
                    <button type="button" className="ai-message-action-btn" onClick={handleShare} title="Share" aria-label="Share response">
                        <Share2 size={14} />
                    </button>
                    {isLastMessage && (
                        <button type="button" className="ai-message-action-btn" onClick={() => onRegenerate(msg.id)} title="Retry" aria-label="Regenerate this response">
                            <RefreshCw size={14} />
                        </button>
                    )}
                    <div style={{ position: 'relative' }} ref={menuRef}>
                        <button
                            type="button" className="ai-message-action-btn" onClick={() => setMenuOpen((v) => !v)}
                            title="More" aria-label="More actions" aria-expanded={menuOpen}
                        >
                            <MoreHorizontal size={14} />
                        </button>
                        {menuOpen && (
                            <div className="ai-message-menu-popover">
                                <button type="button" className="ai-message-menu-item" onClick={() => { setSourceOpen(true); setMenuOpen(false); }}>
                                    <Code2 size={14} /> View source
                                </button>
                                <button type="button" className="ai-message-menu-item" onClick={() => { onBranch(msg.id); setMenuOpen(false); }}>
                                    <GitBranch size={14} /> Branch in new chat
                                </button>
                                <button type="button" className="ai-message-menu-item" onClick={() => { onToggleSpeak(msg.id, msg.text); setMenuOpen(false); }}>
                                    {speakingMessageId === msg.id
                                        ? (isSpeechPaused ? <><Play size={14} /> Resume reading</> : <><Pause size={14} /> Pause reading</>)
                                        : <><Volume2 size={14} /> Read aloud</>}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {sourceOpen && (
                <div className="ai-modal-overlay" onClick={() => setSourceOpen(false)}>
                    <div className="ai-modal-card ai-source-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="ai-modal-title">
                            <h3>Message Source</h3>
                            <span>The raw, unrendered text behind this response.</span>
                        </div>
                        <pre className="ai-source-view">{msg.text}</pre>
                        <div className="ai-modal-actions">
                            <button type="button" className="ai-modal-btn" onClick={() => setSourceOpen(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const AIChatArea = ({
    isSidebarOpen, onToggleSidebar,
    messages, isGenerating,
    inputPrompt, onInputChange, onSubmit,
    activeProviderId,
    pendingImage, onAttachImage,
    speakingMessageId, isSpeechPaused, onToggleSpeak,
    onRegenerateMessage, onBranchChat, onToggleMessageLike,
}) => {
    const isMobile = useIsMobile();
    const chatEndRef = useRef(null);
    const messagesScrollRef = useRef(null);
    const textareaRef = useRef(null);
    const attachMenuRef = useRef(null);
    const [attachMenuOpen, setAttachMenuOpen] = useState(false);
    const cameraCaptureRef = useRef(null);
    const [imageError, setImageError] = useState('');
    const [textScale, setTextScale] = useState(readStoredTextScale);
    useEffect(() => {
        try { localStorage.setItem(TEXT_SCALE_STORAGE_KEY, String(textScale)); } catch (e) { /* private-browsing/quota - the zoom level just won't persist across reloads */ }
    }, [textScale]);
    const zoomOut = () => setTextScale((v) => Math.max(TEXT_SCALE_MIN, Math.round((v - TEXT_SCALE_STEP) * 10) / 10));
    const zoomIn = () => setTextScale((v) => Math.min(TEXT_SCALE_MAX, Math.round((v + TEXT_SCALE_STEP) * 10) / 10));

    const { isSupported: micSupported, isListening, start: startListening, stop: stopListening, getAudioLevels } = useSpeechToText({
        onResult: (transcript) => onInputChange((prev) => (prev ? `${prev.trim()} ${transcript}` : transcript)),
    });

    // Real auto-expanding textarea - measures its own scrollHeight after
    // every content change and grows to fit, capped by aiChat.css's
    // max-height (200px), beyond which it scrolls internally instead of
    // pushing the header/messages area around.
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }, [inputPrompt]);

    useEffect(() => {
        messagesScrollRef.current && chatEndRef.current?.scrollIntoView({ behavior: isGenerating ? 'auto' : 'smooth' });
    }, [messages, isGenerating]);

    // attachMenuOpen is deliberately NOT handled here anymore -
    // AttachmentMenu.jsx now owns its own outside-click-to-close (it's a
    // reusable component, so it has to be self-contained rather than
    // depending on this page's own effect). Live Context and the model
    // picker used to have their own matching outside-click effect here
    // too, but both moved into AISidebar.jsx's own "This Chat" section
    // (see that file) along with the Read Aloud unmount cleanup, which
    // now lives in AILayout.jsx since the speaking state itself is owned
    // there.

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
        }
    };

    // Real file staging - reads the picked image or PDF, converts it to
    // base64, and hands it up to AIPage.jsx as pendingImage.
    // Gemini's own API genuinely accepts application/pdf as an inline_data
    // mimeType the same way it accepts image/* - real native document
    // understanding, not a separate text-extraction pipeline (the syllabus
    // importer's own pdf.js route is a different, non-Gemini path for a
    // different feature) - so a PDF sent this way is read by the live
    // model itself, not a fake "upload" that silently does nothing.
    // Grok's own vision-capable models (grok-4/grok-4-fast) also read a
    // real inline image via the standard OpenAI-style image_url content
    // part (see buildOpenAiMessages in AIPage.jsx) - but xAI's endpoint
    // has no document/PDF understanding the way Gemini's inline_data does,
    // so a PDF is rejected here specifically when Grok is active rather
    // than silently sent as an "image" xAI can't actually read. previewUrl
    // is a separate, cheap object URL used only for the on-screen
    // thumbnail/message bubble - never sent to any API (the API gets the
    // base64 field instead).
    // The real, shared core - extracted so a camera-captured photo
    // (CameraCapture.jsx hands back a plain File, same as a picked one)
    // goes through the EXACT same validation/base64/attach logic as a
    // file-input pick, rather than a second, parallel implementation that
    // could quietly drift out of sync with this one over time.
    const processPickedFile = async (file) => {
        if (!file) return;
        setImageError('');
        const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
        const isImage = file.type.startsWith('image/');
        if (!isPdf && !isImage) {
            setImageError('Please choose an image or a PDF file.');
            return;
        }
        if (isPdf && activeProviderId !== 'gemini') {
            setImageError('PDF analysis needs Gemini - switch providers in Settings, or attach an image instead.');
            return;
        }
        if (file.size > MAX_ATTACHMENT_BYTES) {
            setImageError('File is too large (max 8MB).');
            return;
        }
        try {
            const base64 = await fileToBase64(file);
            onAttachImage({
                mimeType: isPdf ? 'application/pdf' : (file.type || 'image/jpeg'),
                base64,
                previewUrl: isPdf ? null : URL.createObjectURL(file),
                name: file.name,
                kind: isPdf ? 'pdf' : 'image',
            });
        } catch (err) {
            setImageError('Could not read this file.');
        }
    };

    const handleCameraCapture = (file) => {
        processPickedFile(file);
    };

    const isEmpty = messages.length <= 1;
    // Every provider with a genuine, live-verified vision path gets the
    // attach menu enabled - not just Gemini. Grok's current models
    // (grok-4/grok-4-fast) really do accept an inline image the same way
    // Gemini does (see AIPage.jsx's buildOpenAiMessages); DeepSeek's own
    // chat-completions API has no image input at all, and OpenAI's
    // endpoint is unreachable from this browser entirely (CORS - see
    // openaiClient.js's own header comment), so those two stay disabled
    // here honestly rather than pretending to support something neither
    // API actually does.
    const canUploadFile = activeProviderId === 'gemini' || activeProviderId === 'grok';

    // The composer itself - one single definition, mounted in one of two
    // different places depending on isEmpty (see the return JSX below).
    // Never rendered twice at once.
    const composerBody = (
        <>
            {pendingImage && (
                <div className="ai-pending-image-chip">
                    {pendingImage.kind === 'pdf'
                        ? <div className="ai-pending-image-chip-icon"><FileText size={16} /></div>
                        : <img src={pendingImage.previewUrl} alt="" />}
                    <span className="ai-pending-image-chip-name">{pendingImage.name}</span>
                    <button type="button" className="ai-pending-image-chip-remove" onClick={() => onAttachImage(null)} aria-label="Remove attachment">
                        <X size={13} />
                    </button>
                </div>
            )}
            {imageError && <span style={{ fontSize: '11px', color: '#EF4444', display: 'block', marginBottom: '8px' }}>{imageError}</span>}
            <div className={`ai-chat-input-pill${isListening ? ' is-listening-pill' : ''}`} data-tour-id="ai-input">
                {isListening ? (
                    // A real "recording mode" swap, not the textarea sitting
                    // there disabled underneath a pulse - attach/textarea/
                    // send all hide while listening (matching Gemini/
                    // ChatGPT's own voice input, per an explicit side-by-
                    // side comparison), replaced by the live waveform and
                    // one obvious Stop control. Tapping the same physical
                    // mic-button slot (now a Square/stop glyph) is the
                    // direct "stop from here" affordance that was missing.
                    <>
                        <VoiceWaveform getAudioLevels={getAudioLevels} />
                        <button
                            type="button"
                            className="ai-input-icon-btn is-listening"
                            onClick={stopListening}
                            title="Stop listening"
                            aria-label="Stop voice input"
                        >
                            <Square size={15} fill="currentColor" />
                        </button>
                    </>
                ) : (
                <>
                <div style={{ position: 'relative', flexShrink: 0 }} ref={attachMenuRef}>
                    {/* A real "+" that rotates into an "X" on open (see
                        aiChat.css's ai-attach-trigger-btn), matching
                        Gemini's own attach-menu trigger. One menu shape for
                        both desktop and mobile now - a real, confirmed
                        side-by-side comparison against ChatGPT's own
                        mobile app showed its "+" menu is the same small,
                        anchored, rounded-card popover on phone as on
                        desktop, not a heavier bottom sheet, so
                        AttachmentMenu.jsx (Camera/Photo/Files) replaces
                        what used to be a separate desktop-only popover
                        here entirely. */}
                    <button
                        type="button" className={`ai-input-icon-btn ai-attach-trigger-btn${attachMenuOpen ? ' is-active' : ''}`}
                        onClick={() => setAttachMenuOpen((v) => !v)}
                        aria-label="Open attach menu" aria-expanded={attachMenuOpen}
                        data-tour-id="ai-plus" title="Attach"
                    >
                        <Plus size={18} />
                    </button>
                    <AttachmentMenu
                        isOpen={attachMenuOpen}
                        onClose={() => setAttachMenuOpen(false)}
                        onCamera={() => cameraCaptureRef.current?.open()}
                        onFileSelected={(file) => processPickedFile(file)}
                        allowFiles={canUploadFile}
                        allowFilesHint="Switch to Gemini or Grok to analyze"
                        showCamera={isMobile}
                        // Grok has no PDF/document understanding (image-only
                        // vision) - not offering PDFs as pickable at all when
                        // it's the active provider avoids a pick-then-error
                        // dead end; processPickedFile's own isPdf check below
                        // is the real enforcement, this is just narrowing what
                        // the native file picker even shows to match it.
                        filesAccept={activeProviderId === 'gemini' ? 'image/*,.pdf,application/pdf' : 'image/*'}
                        style={{ left: 0, bottom: 'calc(100% + 10px)' }}
                        triggerRef={attachMenuRef}
                    />
                    <CameraCapture
                        ref={cameraCaptureRef}
                        onCapture={handleCameraCapture}
                    />
                </div>

                <textarea
                    ref={textareaRef}
                    className="ai-chat-input-textarea"
                    aria-label="Chat message"
                    placeholder="Ask anything"
                    rows={1}
                    value={inputPrompt}
                    onChange={(e) => onInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                />

                {micSupported && (
                    <button
                        type="button"
                        className="ai-input-icon-btn"
                        onClick={startListening}
                        title="Voice input"
                        aria-label="Start voice input"
                    >
                        <Mic size={17} />
                    </button>
                )}

                <button
                    type="button"
                    className="ai-input-icon-btn ai-send-btn"
                    disabled={isGenerating || (!inputPrompt.trim() && !pendingImage)}
                    aria-label="Send message"
                    onClick={onSubmit}
                >
                    <Send size={16} />
                </button>
                </>
                )}
            </div>
        </>
    );

    return (
        <div className="ai-chat-area">
            <header className="ai-chat-header">
                {/* Mobile-only open-trigger (hidden on desktop via CSS) - the
                    sidebar's own hamburger (directly above its "+ New Chat",
                    per the requested alignment) is the real desktop toggle
                    now. Mobile still needs this one too: the off-canvas
                    sidebar is invisible while closed, so its own internal
                    toggle can't be what opens it in the first place.

                    The custom MobileMenuIcon here specifically, NOT the
                    shared SidebarToggleIcon (its PanelLeft box+divider
                    shape) - a real, confirmed side-by-side comparison
                    against ChatGPT's own MOBILE header showed two plain
                    bars of different lengths with no box around them,
                    reserving the box+divider icon for its DESKTOP
                    sidebar's own collapse control instead (still
                    SidebarToggleIcon there - see AISidebar.jsx's own
                    toggle button, untouched). No background/border at
                    rest either now (see aiChat.css's own .ai-chat-header-
                    menu-btn override) - the constant visible box around
                    it was the other real, confirmed mismatch against that
                    same reference. This button only ever renders on
                    mobile (hidden on desktop via CSS), so none of this
                    touches desktop at all. */}
                <button
                    type="button" className="ai-chat-header-btn ai-chat-header-menu-btn" onClick={onToggleSidebar}
                    title={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'} aria-label="Toggle sidebar"
                    data-tour-id="ai-menu"
                >
                    <MobileMenuIcon size={20} />
                </button>

                {/* Mobile-only "Nexus AI" label - a real, confirmed
                    comparison against ChatGPT/Gemini's own mobile apps
                    (both show their name centered in this exact header
                    slot), and with the sidebar off-canvas and invisible
                    until opened, there was nothing on screen naming this
                    page at all otherwise. Deliberately a SEPARATE element
                    from .ai-chat-header-title-group below, not nested
                    inside it - that flex:1 spacer only centers within its
                    own remaining space, which is visibly NOT the header's
                    true midpoint once its two neighbors (a small square
                    hamburger button vs. the noticeably wider zoom-control
                    pill) have unequal widths - confirmed live against a
                    real screenshot showing the title skewed toward the
                    hamburger side. Absolutely positioned against
                    .ai-chat-header's own position:relative instead, so
                    this centers on the header's real midpoint regardless
                    of how wide either sibling is; pointer-events:none
                    since it's plain non-interactive text sitting over
                    those siblings' own click zones on either side. */}
                {isMobile && <span className="ai-chat-header-mobile-title">Nexus AI</span>}

                {/* Desktop still carries no title text - a real, direct
                    side-by-side comparison against Gemini's own chat page
                    showed its in-page header carries none either (only
                    the browser tab does), and the coach name is already
                    visible via its highlighted entry in the sidebar. This
                    stays an empty group on every viewport now, doing its
                    one real job: pushing the actions below to the right
                    via flex:1 (see aiChat.css's .ai-chat-header-title-group). */}
                <div className="ai-chat-header-title-group" />

                <div className="ai-chat-header-actions">
                    {/* Real +/- text zoom for the chat content, matching a
                        browser's own Cmd+/Cmd- - scoped to just the message
                        text (see --ai-chat-text-scale below), not the whole
                        app's UI. The one control explicitly kept in the
                        header rather than moved to the sidebar. */}
                    <div className="ai-zoom-control-group">
                        <button
                            type="button" className="ai-zoom-btn" onClick={zoomOut}
                            disabled={textScale <= TEXT_SCALE_MIN}
                            title="Decrease chat text size" aria-label="Decrease chat text size"
                        >
                            <Minus size={14} />
                        </button>
                        <button
                            type="button" className="ai-zoom-btn" onClick={zoomIn}
                            disabled={textScale >= TEXT_SCALE_MAX}
                            title="Increase chat text size" aria-label="Increase chat text size"
                        >
                            <Plus size={14} />
                        </button>
                    </div>

                    {/* Sits right after the zoom control, exactly as asked -
                        and, matching Gemini's own chat page, doesn't exist
                        at all until Read Aloud is actually triggered from
                        some message's "..." menu below (speakingMessageId
                        is null otherwise). Real pause/resume, not a
                        cancel-and-replay: pressing it while playing calls
                        speechSynthesis.pause() (icon flips to Play);
                        pressing it again calls resume() and the SAME
                        utterance continues from exactly where it left off,
                        not from the beginning - see toggleSpeakMessage in
                        AILayout.jsx and chatSpeech.js's pause/resume
                        helpers. */}
                    {speakingMessageId && (
                        <button
                            type="button" className="ai-chat-header-btn"
                            onClick={() => onToggleSpeak(speakingMessageId, '')}
                            title={isSpeechPaused ? 'Resume reading' : 'Pause reading'}
                            aria-label={isSpeechPaused ? 'Resume reading aloud' : 'Pause reading aloud'}
                        >
                            {isSpeechPaused ? <Play size={16} /> : <Pause size={16} />}
                        </button>
                    )}
                </div>
            </header>

            <div className="ai-chat-messages" ref={messagesScrollRef} style={{ '--ai-chat-text-scale': textScale }}>
                {isEmpty ? (
                    // Clean, centered empty state now - no icon above the
                    // heading, no quick-prompt grid below it - matching a
                    // real chat app's own fresh-chat view (ChatGPT's "What's
                    // on the agenda today?") per explicit request. The
                    // composer itself lives right here too, directly under
                    // the greeting - see composerBody below - rather than
                    // pinned to the screen edge the way ChatGPT/Gemini's own
                    // fresh-chat view also keeps it near the greeting, not
                    // docked at the true bottom, until a real conversation
                    // exists.
                    <div className="ai-chat-empty-state">
                        <p className="ai-empty-state-hint">What would you like to know?</p>
                        <div className="ai-empty-state-composer">{composerBody}</div>
                    </div>
                ) : (
                    <div className="ai-chat-messages-inner">
                        {messages.map((msg, index) => (
                            <Fragment key={msg.id}>
                                {shouldShowTimeDivider(msg, index, messages) && (
                                    <div className="ai-time-divider">{msg.time}</div>
                                )}
                                <MessageBubble
                                    msg={msg}
                                    isLastMessage={index === messages.length - 1}
                                    onRegenerate={onRegenerateMessage}
                                    onBranch={onBranchChat}
                                    onToggleLike={onToggleMessageLike}
                                    speakingMessageId={speakingMessageId}
                                    isSpeechPaused={isSpeechPaused}
                                    onToggleSpeak={onToggleSpeak}
                                />
                            </Fragment>
                        ))}
                        {isGenerating && (
                            <div className="ai-typing-indicator">
                                <div className="ai-typing-bubble">
                                    <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                                    Analyzing Nexus Context &amp; Memory
                                    <span className="ai-typing-dots"><span /><span /><span /></span>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>
                )}
            </div>

            {/* Only mounts once a real conversation exists - the empty
                state renders composerBody inline above instead. This is
                the real "the composer comes down and docks" moment: the
                very same JSX (composerBody) simply mounts in a different,
                bottom-pinned spot the instant the first message is sent,
                with a real entrance animation (is-docking, see
                aiChat.css) rather than an abrupt instant jump. */}
            {!isEmpty && (
                <div className="ai-chat-input-container is-docking">
                    <div className="ai-chat-input-inner">{composerBody}</div>
                </div>
            )}
        </div>
    );
};

export default AIChatArea;
