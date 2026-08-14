// src/components/AIQueryBox.jsx
//
// A real, interactive, live-data-connected AI query widget, shared
// across every module's own "AI Coach" section (Study/Gym/Finance/
// Nutrition) - genuinely queries the same, single, shared
// nexusAIEngine every dedicated AI section across the OS now uses,
// rather than each module inventing its own, separate, static text.
//
// `context` is the real, live data object the consuming page passes in
// (its own subjects/workouts/transactions/etc. - only whichever domains
// that page actually has real data for need to be included; the engine
// itself supplies honest, empty defaults for anything omitted).
// `persona` is that module's own, fixed domain (e.g. 'fitness' for the
// Gym module), so an ambiguous question ("how am I doing?") genuinely,
// correctly defaults to that module's own domain.
import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, RefreshCw } from 'lucide-react';
import { generateNexusAIResponse } from '../utils/nexusAIEngine.js';

const AIQueryBox = ({ context, persona, title = 'AI Coach', placeholder = 'Ask a question about your real data...' }) => {
    const [query, setQuery] = useState('');
    const [messages, setMessages] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const streamTimeoutRef = useRef(null);
    const streamIntervalRef = useRef(null);
    const endRef = useRef(null);

    // Cleans up any in-flight timer if the user navigates away from this
    // module mid-response - the same, real safeguard AIPage.jsx uses,
    // preventing a dangling timer from updating state after unmount.
    useEffect(() => {
        return () => {
            if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);
            if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
        };
    }, []);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const text = query.trim();
        if (!text || isGenerating) return;

        const userMsg = { id: Date.now().toString(), sender: 'user', text };
        setMessages((prev) => [...prev, userMsg]);
        setQuery('');
        setIsGenerating(true);

        streamTimeoutRef.current = setTimeout(() => {
            const responseText = generateNexusAIResponse(text, context, persona);
            const aiMsgId = (Date.now() + 1).toString();
            setMessages((prev) => [...prev, { id: aiMsgId, sender: 'ai', text: '' }]);

            const CHUNK_SIZE = 3;
            let revealed = 0;
            streamIntervalRef.current = setInterval(() => {
                revealed = Math.min(responseText.length, revealed + CHUNK_SIZE);
                setMessages((prev) => prev.map((m) => m.id === aiMsgId ? { ...m, text: responseText.slice(0, revealed) } : m));
                if (revealed >= responseText.length) {
                    clearInterval(streamIntervalRef.current);
                    streamIntervalRef.current = null;
                    setIsGenerating(false);
                }
            }, 18);
        }, 500);
    };

    return (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-premium)', borderRadius: '20px', padding: '20px', boxShadow: 'var(--premium-shadow)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
                <Sparkles size={20} />
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>{title}</h3>
            </div>

            {messages.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '260px', overflowY: 'auto', paddingRight: '4px' }}>
                    {messages.map((msg) => (
                        <div key={msg.id} style={{ display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                            <div style={{ maxWidth: '85%', background: msg.sender === 'user' ? 'var(--primary)' : 'var(--widget-bg)', color: msg.sender === 'user' ? 'var(--text-on-primary)' : 'var(--text-primary)', padding: '10px 14px', borderRadius: '12px', border: msg.sender === 'ai' ? '1px solid var(--border-premium)' : 'none', fontSize: '13px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    {isGenerating && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '12px' }}>
                            <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Thinking...
                        </div>
                    )}
                    <div ref={endRef} />
                </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px' }}>
                <input
                    type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder}
                    style={{ flex: 1, padding: '11px 14px', borderRadius: '12px', border: '1px solid var(--border-premium)', background: 'var(--surface-inset)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                />
                <button
                    type="submit" disabled={isGenerating || !query.trim()}
                    style={{ padding: '0 16px', background: 'var(--primary)', color: 'var(--text-on-primary)', border: 'none', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: (!query.trim() || isGenerating) ? 0.6 : 1 }}
                >
                    <Send size={16} />
                </button>
            </form>
        </div>
    );
};

export default AIQueryBox;
