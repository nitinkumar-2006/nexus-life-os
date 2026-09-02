// src/utils/openaiClient.js
//
// A real, live client for OpenAI's own Chat Completions REST endpoint -
// same no-SDK approach as geminiClient.js, just `fetch` against the same
// api.openai.com host SettingsPage.jsx already validates the user's key
// against (GET /v1/models with a Bearer token). Genuinely streams (SSE),
// so onChunk fires as real text actually arrives from OpenAI.
//
// Every failure is a real, typed OpenAiApiError with a message meant to
// be shown to the user as-is.
const API_BASE = 'https://api.openai.com/v1';
// A current, generally-available chat model. Deliberately a single name,
// not a fallback chain the way geminiClient.js tries several candidates:
// that pattern only helps when a "model not found" arrives as an actual
// HTTP response to inspect, but every real call to this endpoint from a
// browser is rejected by CORS before any response is ever received (see
// the catch block below) - a chain here would just retry the identical
// network-level rejection N times for no different outcome.
const OPENAI_MODEL = 'gpt-4o';

export class OpenAiApiError extends Error {
    constructor(message, kind = 'unknown') {
        super(message);
        this.name = 'OpenAiApiError';
        this.kind = kind;
    }
}

const describeHttpError = async (response) => {
    let detail = '';
    let code = '';
    try {
        const body = await response.json();
        detail = body?.error?.message || '';
        code = body?.error?.code || body?.error?.type || '';
    } catch (e) { /* body wasn't JSON - fall through to the status-based message below */ }

    if (response.status === 401) {
        return new OpenAiApiError('Your OpenAI API key is invalid. Update it in Settings → Security & API Integrations.', 'invalid_key');
    }
    if (response.status === 429) {
        const isQuota = code === 'insufficient_quota' || /quota/i.test(detail);
        return new OpenAiApiError(
            isQuota
                ? 'Your OpenAI account has no remaining quota. Check your plan and billing at platform.openai.com.'
                : 'OpenAI API rate limit exceeded. Wait a moment and try again.',
            isQuota ? 'quota' : 'rate_limit'
        );
    }
    if (response.status === 403) {
        return new OpenAiApiError(detail || 'This OpenAI API key does not have permission for this request.', 'forbidden');
    }
    if (response.status === 404) {
        return new OpenAiApiError(`The OpenAI model "${OPENAI_MODEL}" is not available for this key.`, 'model_unavailable');
    }
    return new OpenAiApiError(detail || `OpenAI API request failed (HTTP ${response.status}).`, 'unknown');
};

// messages: [{ role: 'system' | 'user' | 'assistant', content }, ...] -
// OpenAI's own native shape, so the caller passes the system instruction
// as the first message rather than a separate field the way Gemini's API
// wants it.
// onChunk(fullTextSoFar, newTextThisChunk) fires as each real SSE event
// arrives. Returns the final full text on success; throws OpenAiApiError
// on any failure.
export const streamOpenAiResponse = async ({ apiKey, messages, onChunk, signal }) => {
    if (!apiKey || !apiKey.trim()) {
        throw new OpenAiApiError('No OpenAI API key is configured. Add one in Settings → Security & API Integrations.', 'missing_key');
    }

    let response;
    try {
        response = await fetch(`${API_BASE}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey.trim()}`,
            },
            signal,
            body: JSON.stringify({
                model: OPENAI_MODEL,
                messages,
                stream: true,
                temperature: 0.7,
                max_tokens: 1536,
            }),
        });
    } catch (e) {
        if (e.name === 'AbortError') throw e;
        // Confirmed via a real, live request in this exact app: OpenAI's
        // /v1/chat/completions endpoint sends no Access-Control-Allow-Origin
        // header, so it rejects being called directly from browser
        // JavaScript entirely - a hard restriction on OpenAI's side, true
        // for any web app, not something a different fetch call here can
        // work around. (Notably /v1/models - what this app's own Settings
        // page uses to validate the key - DOES allow cross-origin browser
        // requests, which is why the key can show "Connected" there while
        // this call still fails: two different CORS policies on OpenAI's
        // side for two different endpoints.) A genuine network outage
        // produces the exact same opaque "failed to fetch" the browser
        // gives for a CORS block - JS can't tell them apart - but a real
        // proxy-less browser call to THIS endpoint specifically fails this
        // way essentially always, so naming the real, known cause here is
        // far more honest than a generic "check your connection" that
        // would send the user chasing a problem that isn't theirs.
        throw new OpenAiApiError('OpenAI blocks direct chat requests from a browser (no CORS support on this endpoint) - this needs a small server-side proxy to work, which Nexus doesn\'t have yet. Gemini works directly and doesn\'t have this restriction.', 'cors_blocked');
    }

    if (!response.ok) throw await describeHttpError(response);
    if (!response.body) throw new OpenAiApiError('Streaming is not supported in this browser - no response body reader available.', 'unsupported');

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
            if (!jsonStr) continue;
            if (jsonStr === '[DONE]') continue; // OpenAI's own explicit stream-end sentinel, not a JSON payload
            let parsed;
            try {
                parsed = JSON.parse(jsonStr);
            } catch (e) {
                continue; // a malformed/partial fragment - safe to skip
            }

            const finishReason = parsed?.choices?.[0]?.finish_reason;
            if (finishReason === 'content_filter') {
                throw new OpenAiApiError('OpenAI declined to continue this response (content filter).', 'blocked');
            }

            const textPart = parsed?.choices?.[0]?.delta?.content || '';
            if (textPart) {
                fullText += textPart;
                onChunk(fullText, textPart);
            }
        }
    }

    if (!fullText) throw new OpenAiApiError('OpenAI returned an empty response for this prompt.', 'empty');
    return fullText;
};
