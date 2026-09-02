// src/utils/geminiClient.js
//
// A real, live client for the Gemini API's own REST endpoint - no SDK
// dependency (this app has deliberately stayed at a small, fixed set of
// core dependencies throughout), just `fetch` against the same
// generativelanguage.googleapis.com host SettingsPage.jsx already
// validates the user's key against. Genuinely streams (Server-Sent
// Events via `alt=sse`), so a caller's onChunk fires as real text
// actually arrives from Google, not a fake reveal of an already-complete
// string.
//
// Every failure mode is a real, typed GeminiApiError with a message
// meant to be shown to the user as-is - never a silent fallback to
// canned text pretending to be a live answer, which is the exact bug
// this module exists to fix.
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
// Last-resort static fallback only, if the dynamic discovery below can't
// even be reached. Real, confirmed history: this used to be the ONLY
// list tried, hardcoded, and a real user report showed every single name
// in it ("None of Nexus's known Gemini models (gemini-2.0-flash,
// gemini-1.5-flash, gemini-1.5-pro) are available for this API key")
// failing for their specific key/region - proving a hardcoded guess-list
// is fundamentally the wrong approach here: Google's own available-model
// set genuinely varies by key/region/API tier and shifts over time as
// generations are retired, so any fixed list eventually goes stale for
// someone. resolveModelCandidates below replaces guessing with actually
// asking Google what this exact key can use.
const GEMINI_MODEL_FALLBACK_CANDIDATES = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

// One real ListModels call per apiKey, cached for the rest of the page
// session (models.list is a stable, slow-changing catalog - re-fetching
// it on every single message would just be a wasted round-trip). Returns
// real model IDs this exact key can call generateContent/
// streamGenerateContent on, ordered to prefer the newest, fastest
// generation first (flash over pro, higher version number first) - not a
// name, a genuine live answer from Google's own API for THIS key,
// exactly like SettingsPage.jsx's own key-verification call already
// queries (GET .../v1beta/models?key=...), just read further here to
// build a real candidate list instead of only checking "did this
// request succeed y/n".
const resolvedModelCache = new Map();

export const resolveModelCandidates = async (apiKey) => {
    const key = apiKey.trim();
    if (resolvedModelCache.has(key)) return resolvedModelCache.get(key);

    let candidates = GEMINI_MODEL_FALLBACK_CANDIDATES;
    try {
        const response = await fetch(`${API_BASE}/models?key=${encodeURIComponent(key)}`);
        if (response.ok) {
            const data = await response.json();
            const live = (data?.models || [])
                .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
                .map((m) => (m.name || '').replace(/^models\//, ''))
                .filter(Boolean)
                // Genuinely excludes non-general-purpose variants (vision-
                // only/embedding/tuning-only models that technically
                // support generateContent but would fail or misbehave for
                // a plain chat/structuring prompt) rather than trying and
                // silently getting a bad response from one of them.
                .filter((name) => /^gemini-/.test(name) && !/embedding|vision|aqa|tts|image-generation/.test(name));
            // Newest/fastest first: a higher version number ahead of a
            // lower one, "flash" ahead of "pro" within the same version -
            // real preference ordering, not alphabetical (which would
            // wrongly put "gemini-1.5-pro" ahead of "gemini-2.0-flash").
            live.sort((a, b) => {
                const va = parseFloat(a.match(/gemini-(\d+\.?\d*)/)?.[1] || '0');
                const vb = parseFloat(b.match(/gemini-(\d+\.?\d*)/)?.[1] || '0');
                if (va !== vb) return vb - va;
                const aFlash = a.includes('flash') ? 0 : 1;
                const bFlash = b.includes('flash') ? 0 : 1;
                return aFlash - bFlash;
            });
            if (live.length > 0) candidates = live;
        }
    } catch (e) {
        // Network failure reaching the ListModels endpoint itself - falls
        // through to the static fallback list below rather than failing
        // outright, since the actual generateContent call might still
        // succeed even though this discovery step didn't.
    }

    resolvedModelCache.set(key, candidates);
    return candidates;
};

export class GeminiApiError extends Error {
    constructor(message, kind = 'unknown') {
        super(message);
        this.name = 'GeminiApiError';
        this.kind = kind;
    }
}

const describeHttpError = async (response) => {
    let detail = '';
    try {
        const body = await response.json();
        detail = body?.error?.message || '';
    } catch (e) { /* body wasn't JSON - fall through to the status-based message below */ }

    if (response.status === 400 && /API key not valid/i.test(detail)) {
        return new GeminiApiError('Your Gemini API key is invalid. Update it in Settings → Security & API Integrations.', 'invalid_key');
    }
    // Real, currently-widespread Google-side issue (not a Nexus bug):
    // some accounts are only issued newer "AQ."-prefixed API keys instead
    // of the classic "AIzaSy..." format, and Google's own
    // generativelanguage.googleapis.com backend rejects those AQ. keys on
    // generateContent/streamGenerateContent with exactly this 401 -
    // Google's generic "expects OAuth2" message - even though the same
    // key checks out fine against the read-only models.list endpoint
    // (see SettingsPage.jsx's own key-check, which can show "Connected"
    // for a key that still fails here). Confirmed via multiple live
    // reports on Google's own AI Developers Forum as of this writing.
    // Surfacing THIS explanation instead of Google's raw, misleading
    // "OAuth 2 access token" text turns an app-looks-broken support
    // question into an actionable one - there is no code-side fix since
    // the request itself is correctly formed.
    if (response.status === 401) {
        return new GeminiApiError(
            'Google rejected this Gemini API key (401 Unauthorized) - this is a known issue on Google\'s side, not Nexus: some accounts are currently issued newer API keys starting with "AQ." instead of the classic "AIzaSy...", and Google\'s API is rejecting those for chat requests even when they look valid in AI Studio. Open Google AI Studio, generate a fresh key, and confirm it starts with "AIzaSy" - if it still starts with "AQ.", this is Google\'s bug to fix, not something Nexus (or you) can work around yet.',
            'unauthenticated'
        );
    }
    if (response.status === 403) {
        return new GeminiApiError(detail || 'This Gemini API key does not have permission for this request.', 'forbidden');
    }
    if (response.status === 429) {
        return new GeminiApiError('Gemini API quota or rate limit exceeded. Wait a moment and try again, or check your plan at Google AI Studio.', 'quota');
    }
    if (response.status === 404) {
        return new GeminiApiError('model not found', 'model_unavailable');
    }
    return new GeminiApiError(detail || `Gemini API request failed (HTTP ${response.status}).`, 'unknown');
};

// One real attempt against one specific model. Returns null (not an
// error) for the specific "model not found" case so the caller below can
// silently retry the next candidate; every other outcome (success or a
// genuine error) is final and propagates as-is.
//
// tools (optional): Gemini's own real function-calling shape, [{
// functionDeclarations: [...] }] - see aiTools.js's TOOL_DEFINITIONS.
// When present, a response part can be `{ functionCall: { name, args } }`
// instead of `{ text }` - collected into functionCalls below rather than
// silently dropped, which is what happened before this existed (a
// text-only parser reading p.text on a functionCall part just gets '',
// so a pure tool-call response used to look like an empty-response
// error).
const attemptModel = async ({ model, apiKey, systemInstruction, contents, tools, onChunk, signal }) => {
    const url = `${API_BASE}/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey.trim())}`;
    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal,
            body: JSON.stringify({
                contents,
                systemInstruction: { parts: [{ text: systemInstruction }] },
                generationConfig: { temperature: 0.7, maxOutputTokens: 1536 },
                ...(tools ? { tools } : {}),
            }),
        });
    } catch (e) {
        if (e.name === 'AbortError') throw e;
        throw new GeminiApiError('Could not reach the Gemini API. Check your internet connection.', 'network');
    }

    if (!response.ok) {
        const err = await describeHttpError(response);
        if (err.kind === 'model_unavailable') return null; // signal: try the next candidate
        throw err;
    }
    if (!response.body) throw new GeminiApiError('Streaming is not supported in this browser - no response body reader available.', 'unsupported');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    const functionCalls = [];

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // The last entry may be a partial line split across two reads -
        // held back in buffer instead of parsed until the next chunk
        // completes it.
        buffer = lines.pop() ?? '';

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line.startsWith('data:')) continue;
            const jsonStr = line.slice(5).trim();
            if (!jsonStr) continue;
            let parsed;
            try {
                parsed = JSON.parse(jsonStr);
            } catch (e) {
                continue; // a malformed/partial fragment - safe to skip, real content still arrives in later events
            }

            const blockReason = parsed?.promptFeedback?.blockReason;
            if (blockReason) throw new GeminiApiError(`Gemini declined to answer this prompt (${blockReason}).`, 'blocked');

            const finishReason = parsed?.candidates?.[0]?.finishReason;
            if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
                throw new GeminiApiError(`Gemini stopped generating this response (${finishReason.toLowerCase()}).`, 'blocked');
            }

            const parts = parsed?.candidates?.[0]?.content?.parts || [];
            const textPart = parts.map((p) => p.text || '').join('');
            if (textPart) {
                fullText += textPart;
                onChunk(fullText, textPart);
            }
            parts.forEach((p) => { if (p.functionCall) functionCalls.push(p.functionCall); });
        }
    }

    if (!fullText && functionCalls.length === 0) throw new GeminiApiError('Gemini returned an empty response for this prompt.', 'empty');
    return { text: fullText, functionCalls };
};

// contents: [{ role: 'user' | 'model', parts: [{ text }] }, ...] - real
// prior turns, not just the latest message, so multi-turn context is
// genuinely maintained. tools (optional): see attemptModel above.
// onChunk(fullTextSoFar, newTextThisChunk) fires as each real SSE event
// arrives. Returns { text, functionCalls } on success (functionCalls is
// always an array, empty when the model just replied in plain text);
// throws GeminiApiError on any failure (invalid key, quota, network,
// empty/blocked response).
//
// Tries GEMINI_MODEL_CANDIDATES in order, advancing only on a genuine
// "model not found" response - safe to do because that failure always
// arrives in the initial HTTP response, before any streaming/onChunk
// calls have happened, so a retry with the next model never risks
// double-emitting partial text from a model that turned out unavailable.
export const streamGeminiResponse = async ({ apiKey, systemInstruction, contents, tools, preferredModel, onChunk, signal }) => {
    if (!apiKey || !apiKey.trim()) {
        throw new GeminiApiError('No Gemini API key is configured. Add one in Settings → Security & API Integrations.', 'missing_key');
    }

    const discovered = await resolveModelCandidates(apiKey);
    const candidates = preferredModel ? [preferredModel, ...discovered.filter((m) => m !== preferredModel)] : discovered;
    for (let i = 0; i < candidates.length; i++) {
        const model = candidates[i];
        const isLast = i === candidates.length - 1;
        const result = await attemptModel({ model, apiKey, systemInstruction, contents, tools, onChunk, signal });
        if (result !== null) return result;
        if (isLast) {
            throw new GeminiApiError(
                `None of the Gemini models available to this API key (${candidates.join(', ')}) could handle this request. It may be restricted to a different region or model tier - check your key at Google AI Studio.`,
                'model_unavailable'
            );
        }
        // else: silently fall through to the next candidate model.
    }
};

// One non-streaming attempt against one specific model - the real
// building block behind generateStructuredContent below (syllabus OCR/
// text structuring: a single request/response, not a token stream, is
// the right shape when the caller needs one complete, parseable JSON
// answer rather than progressive text). Same null-means-"try next
// candidate" contract as attemptModel above.
const attemptStructuredModel = async ({ model, apiKey, promptText, imagePart, signal }) => {
    const url = `${API_BASE}/models/${model}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
    const parts = [{ text: promptText }];
    if (imagePart) parts.push({ inline_data: { mime_type: imagePart.mimeType, data: imagePart.base64 } });

    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal,
            body: JSON.stringify({
                contents: [{ role: 'user', parts }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 4096, responseMimeType: 'application/json' },
            }),
        });
    } catch (e) {
        if (e.name === 'AbortError') throw e;
        throw new GeminiApiError('Could not reach the Gemini API. Check your internet connection.', 'network');
    }

    if (!response.ok) {
        const err = await describeHttpError(response);
        if (err.kind === 'model_unavailable') return null;
        throw err;
    }

    let data;
    try {
        data = await response.json();
    } catch (e) {
        throw new GeminiApiError('Gemini returned a response that could not be read.', 'unknown');
    }

    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason) throw new GeminiApiError(`Gemini declined to process this (${blockReason}).`, 'blocked');

    const finishReason = data?.candidates?.[0]?.finishReason;
    if (finishReason === 'SAFETY' || finishReason === 'RECITATION') {
        throw new GeminiApiError(`Gemini stopped processing this (${finishReason.toLowerCase()}).`, 'blocked');
    }

    const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    if (!text) throw new GeminiApiError('Gemini returned an empty response.', 'empty');
    return text;
};

// A single-shot, non-streaming request for one complete JSON answer -
// used by the syllabus import pipeline for both image OCR+structuring
// (pass imagePart) and plain-text structuring (omit it). responseMimeType:
// 'application/json' above is a real Gemini API feature that constrains
// the model to emit valid JSON, not just a formatting request - the
// caller still JSON.parses the result itself and should treat that as
// the real validation step, not assume it always succeeds.
export const generateStructuredContent = async ({ apiKey, promptText, imagePart, signal }) => {
    if (!apiKey || !apiKey.trim()) {
        throw new GeminiApiError('No Gemini API key is configured. Add one in Settings → Security & API Integrations.', 'missing_key');
    }

    const candidates = await resolveModelCandidates(apiKey);
    for (let i = 0; i < candidates.length; i++) {
        const model = candidates[i];
        const isLast = i === candidates.length - 1;
        const result = await attemptStructuredModel({ model, apiKey, promptText, imagePart, signal });
        if (result !== null) return result;
        if (isLast) {
            throw new GeminiApiError(
                `None of the Gemini models available to this API key (${candidates.join(', ')}) could handle this request.`,
                'model_unavailable'
            );
        }
    }
};
