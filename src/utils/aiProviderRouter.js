// src/utils/aiProviderRouter.js
//
// Provider-agnostic "give me structured JSON back" call, shared by every
// AI-generation feature in Syllabus/Study Hub (syllabus import, AI study
// queue, AI flashcards, AI quizzes) - one real routing layer instead of
// each feature re-deciding which provider to call.
//
// Respects the SAME active-provider choice AIPage.jsx already lets the
// user make (`nexus_ai_provider`), with the identical ready/fallback logic
// AIPage.jsx uses for its own `activeProvider` (prefer the user's saved
// choice if it's genuinely ready, otherwise fall back to the first
// configured-and-confirmed provider) - so switching providers in the AI
// Assistant page also switches which one Syllabus/Study Hub uses, rather
// than a second, independent selection the user would have to keep in
// sync themselves.
//
// OpenAI and 'local' are deliberately excluded from this router entirely:
// openaiClient.js's own header comment documents a live-verified,
// unconditional CORS block on OpenAI's chat endpoint from a browser (true
// for any request shape, not just streaming) - there is no working call
// this router could make to it. 'local' has no real API to call at all.
// Gemini, Grok, and DeepSeek are each live-verified CORS-open in their own
// client files and are the real provider set here.
import { generateStructuredContent, GeminiApiError } from './geminiClient.js';
import { streamGrokResponse, GrokApiError, buildGrokImageContent } from './grokClient.js';
import { streamDeepseekResponse, DeepseekApiError } from './deepseekClient.js';
import { GEMINI_API_KEY_FALLBACK } from '../config/aiConfig.js';

// localStorage itself unreachable (private browsing, quota) - the
// default Gemini key still works here too, same as any other first-run
// install with nothing saved yet.
const EMPTY_AI_PROVIDER_SETTINGS = {
    geminiApiKey: GEMINI_API_KEY_FALLBACK, geminiApiKeyConfirmed: true,
    openaiApiKey: '', openaiApiKeyConfirmed: false,
    grokApiKey: '', grokApiKeyConfirmed: false,
    deepseekApiKey: '', deepseekApiKeyConfirmed: false,
};

// Real, live AI-key state read directly from 'nexus_global_settings' (not
// via useGlobalSettings/GlobalUserSettingsContext, which only exposes its
// own small, curated whitelist of fields and never re-exposes the raw
// settings object). Shared here since this exact field set is now read by
// AIPage.jsx, SyllabusPage.jsx, and StudyPage.jsx alike - a genuine third
// caller is what justifies pulling this out of being duplicated per-page.
export const readAiProviderSettings = () => {
    try {
        const saved = JSON.parse(localStorage.getItem('nexus_global_settings') || '{}');
        return {
            // Real, explicit request: fall back to the app's own default
            // Gemini key when the user hasn't set their own - and treat
            // that as "confirmed" too (there's nothing for the user to
            // confirm, it's already a real, working key). A real user-
            // entered key always wins the moment one exists, exactly
            // like Spotify's own SPOTIFY_CLIENT_ID_FALLBACK precedent in
            // streamingConfig.js.
            geminiApiKey: saved.geminiApiKey || GEMINI_API_KEY_FALLBACK, geminiApiKeyConfirmed: !!saved.geminiApiKeyConfirmed || !saved.geminiApiKey,
            openaiApiKey: saved.openaiApiKey || '', openaiApiKeyConfirmed: !!saved.openaiApiKeyConfirmed,
            grokApiKey: saved.grokApiKey || '', grokApiKeyConfirmed: !!saved.grokApiKeyConfirmed,
            deepseekApiKey: saved.deepseekApiKey || '', deepseekApiKeyConfirmed: !!saved.deepseekApiKeyConfirmed,
        };
    } catch (e) {
        return { ...EMPTY_AI_PROVIDER_SETTINGS };
    }
};

export class AiProviderError extends Error {
    constructor(message, kind = 'unknown') {
        super(message);
        this.name = 'AiProviderError';
        this.kind = kind;
    }
}

const ROUTABLE_PROVIDERS = ['gemini', 'grok', 'deepseek'];
const PROVIDER_LABEL = { gemini: 'Gemini', grok: 'Grok', deepseek: 'DeepSeek' };

// `settings` is the same shape SyllabusPage.jsx's/AIPage.jsx's own
// readAiKeySettings() already returns: { <provider>ApiKey, <provider>ApiKeyConfirmed }
// for each of gemini/openai/grok/deepseek. Returns { provider, apiKey } for
// the provider that should actually be used, or null if none of the three
// routable providers are configured+confirmed.
export const resolveActiveAiProvider = (settings) => {
    const readyMap = {
        gemini: !!settings.geminiApiKeyConfirmed && !!(settings.geminiApiKey || '').trim(),
        grok: !!settings.grokApiKeyConfirmed && !!(settings.grokApiKey || '').trim(),
        deepseek: !!settings.deepseekApiKeyConfirmed && !!(settings.deepseekApiKey || '').trim(),
    };
    let preferred = 'gemini';
    try { preferred = localStorage.getItem('nexus_ai_provider') || 'gemini'; } catch (e) { /* localStorage unavailable - default stands */ }

    const provider = ROUTABLE_PROVIDERS.includes(preferred) && readyMap[preferred]
        ? preferred
        : ROUTABLE_PROVIDERS.find((p) => readyMap[p]) || null;

    if (!provider) return null;
    return { provider, apiKey: settings[`${provider}ApiKey`] };
};

// promptText: the real instruction + content to send.
// imagePart: optional { mimeType, base64 } - a genuine photo/scan to read.
//   Gemini and Grok both have a verified vision path in this app (see
//   file header + grokClient.js's buildGrokImageContent) - passing this
//   with DeepSeek (no image input on its API at all) throws a clear,
//   honest error rather than silently sending text-only and guessing, or
//   fabricating multimodal support that was never actually confirmed to
//   work there. Note: a PDF never reaches this parameter at all - callers
//   (syllabusExtraction.js) extract its real text client-side via pdf.js
//   and send that as plain promptText instead, which is already provider-
//   agnostic and works the same on every routable provider here.
// Returns the raw text response (expected to be JSON - callers parse and
// validate it themselves, same as the existing Gemini-only pipeline did).
export const generateStructuredJSON = async ({ settings, promptText, imagePart, signal }) => {
    const resolved = resolveActiveAiProvider(settings);
    if (!resolved) {
        throw new AiProviderError(
            'No AI provider is configured. Add a Gemini, Grok, or DeepSeek API key in Settings → AI & Learning API Integrations.',
            'no_provider'
        );
    }
    const { provider, apiKey } = resolved;

    if (imagePart && provider === 'deepseek') {
        throw new AiProviderError(
            `Photo import needs Gemini or Grok - your active AI provider is ${PROVIDER_LABEL[provider]}, which can't read images here. Switch providers in Settings → AI Assistant, or upload the syllabus as a PDF instead.`,
            'image_needs_vision_provider'
        );
    }

    try {
        if (provider === 'gemini') {
            return await generateStructuredContent({ apiKey, promptText, imagePart, signal });
        }
        // Grok/DeepSeek have no dedicated non-streaming "structured content"
        // endpoint in this app - their existing stream*Response functions
        // already return the final, complete text once streaming finishes,
        // so a no-op onChunk reuses that real, proven call path as a
        // one-shot request instead of adding a second, parallel endpoint.
        const messages = [{ role: 'user', content: imagePart ? buildGrokImageContent(promptText, imagePart) : promptText }];
        if (provider === 'grok') {
            return await streamGrokResponse({ apiKey, messages, onChunk: () => {}, signal });
        }
        return await streamDeepseekResponse({ apiKey, messages, onChunk: () => {}, signal });
    } catch (e) {
        if (e instanceof GeminiApiError || e instanceof GrokApiError || e instanceof DeepseekApiError) {
            throw e; // already a real, user-facing message from that provider's own client
        }
        throw e;
    }
};
