// src/utils/deepseekClient.js
//
// A real, live client for DeepSeek's own Chat Completions REST endpoint -
// same no-SDK, plain-fetch approach as the other provider clients here.
// Genuinely streams (SSE), so onChunk fires as real text actually arrives.
//
// Live-verified (real OPTIONS preflight against this app's dev origin)
// that api.deepseek.com sends a genuine Access-Control-Allow-Origin on
// both /v1/models and /v1/chat/completions - unlike OpenAI's endpoint
// (see openaiClient.js), a direct browser call here works, no proxy
// needed.
const API_BASE = 'https://api.deepseek.com/v1';
// DeepSeek's own model catalog has been these two stable, documented IDs
// for a long time - used only if the live discovery below can't even be
// reached, same fallback-of-last-resort role as the other clients' lists.
const DEEPSEEK_MODEL_FALLBACK_CANDIDATES = ['deepseek-chat', 'deepseek-reasoner'];

const resolvedModelCache = new Map();

export const resolveDeepseekModels = async (apiKey) => {
    const key = apiKey.trim();
    if (resolvedModelCache.has(key)) return resolvedModelCache.get(key);

    let candidates = DEEPSEEK_MODEL_FALLBACK_CANDIDATES;
    try {
        const response = await fetch(`${API_BASE}/models`, {
            headers: { Authorization: `Bearer ${key}` },
        });
        if (response.ok) {
            const data = await response.json();
            const live = (data?.data || []).map((m) => m.id || '').filter(Boolean);
            if (live.length > 0) candidates = live;
        }
    } catch (e) {
        // Network failure reaching /v1/models itself - falls through to the
        // static fallback list, the real chat call below may still work.
    }

    resolvedModelCache.set(key, candidates);
    return candidates;
};

export class DeepseekApiError extends Error {
    constructor(message, kind = 'unknown') {
        super(message);
        this.name = 'DeepseekApiError';
        this.kind = kind;
    }
}

const describeHttpError = async (response, model) => {
    let detail = '';
    try {
        const body = await response.json();
        detail = body?.error?.message || '';
    } catch (e) { /* body wasn't JSON - fall through to the status-based message below */ }

    if (response.status === 401) {
        return new DeepseekApiError('Your DeepSeek API key is invalid. Update it in Settings → Security & API Integrations.', 'invalid_key');
    }
    if (response.status === 429) {
        const isQuota = /balance|quota|insufficient/i.test(detail);
        return new DeepseekApiError(
            isQuota ? 'Your DeepSeek account has no remaining balance. Check your plan at platform.deepseek.com.' : 'DeepSeek API rate limit exceeded. Wait a moment and try again.',
            isQuota ? 'quota' : 'rate_limit'
        );
    }
    if (response.status === 403) {
        return new DeepseekApiError(detail || 'This DeepSeek API key does not have permission for this request.', 'forbidden');
    }
    if (response.status === 404) {
        return new DeepseekApiError(`model not found: ${model}`, 'model_unavailable');
    }
    return new DeepseekApiError(detail || `DeepSeek API request failed (HTTP ${response.status}).`, 'unknown');
};

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
        throw new DeepseekApiError('Could not reach the DeepSeek API. Check your internet connection.', 'network');
    }

    if (!response.ok) {
        const err = await describeHttpError(response, model);
        if (err.kind === 'model_unavailable') return null;
        throw err;
    }
    if (!response.body) throw new DeepseekApiError('Streaming is not supported in this browser - no response body reader available.', 'unsupported');

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
                throw new DeepseekApiError('DeepSeek declined to continue this response (content filter).', 'blocked');
            }

            // DeepSeek's "reasoner" model streams its chain-of-thought in a
            // separate reasoning_content field before the real answer in
            // content - only the real answer is surfaced to onChunk here,
            // matching what every other provider in this app shows (a
            // clean final answer, not raw model scratch-work).
            const textPart = parsed?.choices?.[0]?.delta?.content || '';
            if (textPart) {
                fullText += textPart;
                onChunk(fullText, textPart);
            }
        }
    }

    if (!fullText) throw new DeepseekApiError('DeepSeek returned an empty response for this prompt.', 'empty');
    return fullText;
};

// messages: OpenAI-shaped [{ role, content }, ...], same as grokClient.js.
// preferredModel: an explicit model id tried first, ahead of the live-
// discovered candidate list - omit to just use live discovery's own top
// preference.
export const streamDeepseekResponse = async ({ apiKey, messages, preferredModel, onChunk, signal }) => {
    if (!apiKey || !apiKey.trim()) {
        throw new DeepseekApiError('No DeepSeek API key is configured. Add one in Settings → Security & API Integrations.', 'missing_key');
    }

    const discovered = await resolveDeepseekModels(apiKey);
    const candidates = preferredModel ? [preferredModel, ...discovered.filter((m) => m !== preferredModel)] : discovered;

    for (let i = 0; i < candidates.length; i++) {
        const model = candidates[i];
        const isLast = i === candidates.length - 1;
        const result = await attemptModel({ model, apiKey, messages, onChunk, signal });
        if (result !== null) return result;
        if (isLast) {
            throw new DeepseekApiError(
                `None of the DeepSeek models available to this API key (${candidates.join(', ')}) could handle this request.`,
                'model_unavailable'
            );
        }
    }
};
