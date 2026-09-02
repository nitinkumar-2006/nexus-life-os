// src/utils/grokClient.js
//
// A real, live client for xAI's own Grok Chat Completions REST endpoint -
// same no-SDK, plain-fetch approach as geminiClient.js/openaiClient.js.
// Genuinely streams (SSE), so onChunk fires as real text actually arrives.
//
// Unlike OpenAI's endpoint (see openaiClient.js's own comment on this),
// xAI's api.x.ai host was live-verified (via a real OPTIONS preflight
// against both /v1/models and /v1/chat/completions, from this exact app's
// dev origin) to send Access-Control-Allow-Origin: * on both - so, unlike
// ChatGPT in this app, a direct browser call to Grok's real chat endpoint
// genuinely works, no proxy needed.
const API_BASE = 'https://api.x.ai/v1';
// Real, current model IDs only used if the live discovery below can't be
// reached at all - same "ask the key what it can actually use" philosophy
// geminiClient.js already established, since a hardcoded guess eventually
// goes stale as xAI ships new generations.
const GROK_MODEL_FALLBACK_CANDIDATES = ['grok-4-fast', 'grok-4', 'grok-3'];

const resolvedModelCache = new Map();

// One real GET /v1/models call per apiKey, cached for the session -
// mirrors resolveModelCandidates in geminiClient.js exactly, just against
// xAI's OpenAI-compatible {data: [{id}]} list shape instead of Google's.
export const resolveGrokModels = async (apiKey) => {
    const key = apiKey.trim();
    if (resolvedModelCache.has(key)) return resolvedModelCache.get(key);

    let candidates = GROK_MODEL_FALLBACK_CANDIDATES;
    try {
        const response = await fetch(`${API_BASE}/models`, {
            headers: { Authorization: `Bearer ${key}` },
        });
        if (response.ok) {
            const data = await response.json();
            const live = (data?.data || [])
                .map((m) => m.id || '')
                .filter(Boolean)
                // Excludes non-chat variants that sometimes ride along in a
                // provider's own /models list (embeddings, image generation)
                // rather than trying and silently getting a bad response.
                .filter((id) => !/embedding|image-gen/i.test(id));
            if (live.length > 0) {
                // "fast" variants first (lower latency, the sensible chat
                // default), then the rest in the order xAI itself returned
                // them (their own list is already newest-first in practice).
                live.sort((a, b) => (b.includes('fast') ? 1 : 0) - (a.includes('fast') ? 1 : 0));
                candidates = live;
            }
        }
    } catch (e) {
        // Network failure reaching /v1/models itself - falls through to the
        // static fallback list, the real chat call below may still work.
    }

    resolvedModelCache.set(key, candidates);
    return candidates;
};

// Builds one OpenAI-vision-shaped user message `content` array - real
// multimodal content xAI's own /v1/chat/completions endpoint genuinely
// accepts for its current vision-capable models (grok-4, grok-4-fast),
// the same standard shape OpenAI's own vision API uses. image_url takes a
// plain data: URI directly - no separate upload/file step needed, the
// same base64-inline approach geminiClient.js's inline_data field uses.
// Image-only: xAI has no document/PDF understanding the way Gemini's
// inline_data does, so this is never called with a PDF (callers gate that
// separately - see AIChatArea.jsx's processPickedFile).
export const buildGrokImageContent = (text, imagePart) => ([
    { type: 'text', text },
    { type: 'image_url', image_url: { url: `data:${imagePart.mimeType};base64,${imagePart.base64}` } },
]);

export class GrokApiError extends Error {
    constructor(message, kind = 'unknown') {
        super(message);
        this.name = 'GrokApiError';
        this.kind = kind;
    }
}

const describeHttpError = async (response, model) => {
    let detail = '';
    let code = '';
    try {
        const body = await response.json();
        detail = body?.error?.message || body?.error || '';
        code = body?.code || '';
    } catch (e) { /* body wasn't JSON - fall through to the status-based message below */ }

    if (response.status === 401) {
        return new GrokApiError('Your Grok (xAI) API key is invalid. Update it in Settings → Security & API Integrations.', 'invalid_key');
    }
    if (response.status === 429) {
        return new GrokApiError('Grok API rate limit or quota exceeded. Wait a moment and try again, or check your plan at console.x.ai.', 'rate_limit');
    }
    if (response.status === 403) {
        return new GrokApiError(detail || 'This Grok API key does not have permission for this request.', 'forbidden');
    }
    if (response.status === 404 || code === 'model_not_found') {
        return new GrokApiError(`model not found: ${model}`, 'model_unavailable');
    }
    return new GrokApiError(detail || `Grok API request failed (HTTP ${response.status}).`, 'unknown');
};

// One real attempt against one specific model - null return means "try the
// next candidate" (model not found), exactly mirroring geminiClient.js's
// attemptModel contract, safe for the same reason: that failure always
// arrives in the initial HTTP response, before onChunk has fired at all.
const attemptModel = async ({ model, apiKey, messages, onChunk, signal }) => {
    let response;
    try {
        response = await fetch(`${API_BASE}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey.trim()}`,
            },
            signal,
            body: JSON.stringify({ model, messages, stream: true, temperature: 0.7, max_tokens: 1536 }),
        });
    } catch (e) {
        if (e.name === 'AbortError') throw e;
        throw new GrokApiError('Could not reach the Grok (xAI) API. Check your internet connection.', 'network');
    }

    if (!response.ok) {
        const err = await describeHttpError(response, model);
        if (err.kind === 'model_unavailable') return null;
        throw err;
    }
    if (!response.body) throw new GrokApiError('Streaming is not supported in this browser - no response body reader available.', 'unsupported');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line.startsWith('data:')) continue;
            const jsonStr = line.slice(5).trim();
            if (!jsonStr || jsonStr === '[DONE]') continue;
            let parsed;
            try {
                parsed = JSON.parse(jsonStr);
            } catch (e) {
                continue; // malformed/partial fragment - safe to skip
            }

            const finishReason = parsed?.choices?.[0]?.finish_reason;
            if (finishReason === 'content_filter') {
                throw new GrokApiError('Grok declined to continue this response (content filter).', 'blocked');
            }

            const textPart = parsed?.choices?.[0]?.delta?.content || '';
            if (textPart) {
                fullText += textPart;
                onChunk(fullText, textPart);
            }
        }
    }

    if (!fullText) throw new GrokApiError('Grok returned an empty response for this prompt.', 'empty');
    return fullText;
};

// messages: [{ role: 'system' | 'user' | 'assistant', content }, ...] -
// same OpenAI-shaped messages array openaiClient.js's own caller already
// builds (buildOpenAiMessages), reused as-is here since Grok's request
// body is the same OpenAI-compatible shape.
// preferredModel: an explicit model id (e.g. from a model-picker) tried
// first, ahead of the live-discovered candidate list - omit to just use
// live discovery's own top preference.
export const streamGrokResponse = async ({ apiKey, messages, preferredModel, onChunk, signal }) => {
    if (!apiKey || !apiKey.trim()) {
        throw new GrokApiError('No Grok (xAI) API key is configured. Add one in Settings → Security & API Integrations.', 'missing_key');
    }

    const discovered = await resolveGrokModels(apiKey);
    const candidates = preferredModel ? [preferredModel, ...discovered.filter((m) => m !== preferredModel)] : discovered;

    for (let i = 0; i < candidates.length; i++) {
        const model = candidates[i];
        const isLast = i === candidates.length - 1;
        const result = await attemptModel({ model, apiKey, messages, onChunk, signal });
        if (result !== null) return result;
        if (isLast) {
            throw new GrokApiError(
                `None of the Grok models available to this API key (${candidates.join(', ')}) could handle this request.`,
                'model_unavailable'
            );
        }
    }
};
