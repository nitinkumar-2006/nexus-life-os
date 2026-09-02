// src/utils/syllabusExtraction.js
//
// The real syllabus ingestion pipeline: turns an uploaded PDF or photo of
// a physical syllabus into genuine, structured Units/Topics matching
// SyllabusPage.jsx's own real data shape ({ name, topics: [name, ...] }).
//
// Two real, honest input paths:
// - PDF: real client-side text extraction via pdfjs-dist (the same
//   library and dynamic-import pattern statementParser.js already uses
//   for bank statements), then that raw text is handed to Gemini to
//   structure into units/topics.
// - Image (a photo of a physical syllabus page): sent directly to
//   Gemini's vision input as inline image data - genuine OCR + structuring
//   in one real API call, not a second, separate OCR library. This is
//   the actual capability statementParser.js's own PDF parser explicitly
//   says it does NOT attempt ("no OCR is performed, since that's a
//   fundamentally different, much harder problem") - Gemini vision is
//   what makes this new, real, and different for image input.
//
// DOCX is honestly NOT supported here - no dependency-free, reliable way
// to extract its real text exists in this app today (a hand-rolled ZIP/
// XML parser was considered and rejected as too much real risk for a
// feature this size), and adding a new npm dependency just for this one
// format is a real, separate decision this pass doesn't make unilaterally.
// callers should surface a clear, honest message for .docx/.doc rather
// than silently failing or guessing at content.
//
// Every result here is provisional - the caller is expected to show it
// in a real review/edit step before ever committing it into the user's
// actual syllabus data, exactly like statementParser.js's own imported
// rows. The AI can misread messy handwriting or an unusual layout; this
// module never claims its own output is guaranteed correct.
//
// AI-agnostic: routes through aiProviderRouter.js's generateStructuredJSON,
// which uses whichever of Gemini/Grok/DeepSeek the user has active and
// configured in Settings (see that file's own header for why OpenAI isn't
// one of the options, and why a photo/scan specifically still requires
// Gemini regardless of the active provider).
import { generateStructuredJSON, AiProviderError } from './aiProviderRouter.js';

export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
export const SUPPORTED_PDF_TYPE = 'application/pdf';

export class SyllabusExtractionError extends Error {
    constructor(message, kind = 'unknown') {
        super(message);
        this.name = 'SyllabusExtractionError';
        this.kind = kind;
    }
}

// Classifies a File into 'pdf' | 'image' | 'unsupported' - by real MIME
// type first, falling back to the file extension (some OS file pickers/
// camera apps hand back an empty or generic `type` for photos).
export const classifySyllabusFile = (file) => {
    const type = (file.type || '').toLowerCase();
    const name = (file.name || '').toLowerCase();
    if (type === SUPPORTED_PDF_TYPE || name.endsWith('.pdf')) return 'pdf';
    if (SUPPORTED_IMAGE_TYPES.includes(type) || /\.(jpe?g|png|webp|heic|heif)$/.test(name)) return 'image';
    if (/\.(docx?|rtf|odt)$/.test(name) || /word/.test(type)) return 'unsupported-doc';
    return 'unsupported';
};

// ============================================================
// PDF text extraction - mirrors statementParser.js's own dynamic-import
// + worker-URL setup exactly, since duplicating that pattern here is
// safer than importing across module boundaries into a file that isn't
// meant to expose this as a shared utility, and keeps this module
// independently usable/testable.
// ============================================================
let pdfjsLoadPromise = null;
const loadPdfJs = async () => {
    if (!pdfjsLoadPromise) {
        pdfjsLoadPromise = (async () => {
            const pdfjsLib = await import('pdfjs-dist');
            const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
            pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
            return pdfjsLib;
        })();
    }
    return pdfjsLoadPromise;
};

const extractTextFromPdf = async (file) => {
    let pdfjsLib;
    try {
        pdfjsLib = await loadPdfJs();
    } catch (e) {
        throw new SyllabusExtractionError('Could not load the PDF engine. Please try again, or use a photo instead.', 'pdf_engine');
    }

    let pdf;
    try {
        const buffer = await file.arrayBuffer();
        pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    } catch (e) {
        throw new SyllabusExtractionError('This PDF could not be opened - it may be password-protected or corrupted.', 'pdf_open');
    }

    const pageTexts = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
            const page = await pdf.getPage(pageNum);
            const content = await page.getTextContent();
            pageTexts.push(content.items.map((item) => item.str).join(' '));
        } catch (e) {
            // one unreadable page shouldn't sink the whole document - the
            // rest of the extracted text is still real and useful.
        }
    }

    const text = pageTexts.join('\n').replace(/\s+/g, ' ').trim();
    if (!text) {
        throw new SyllabusExtractionError(
            'No readable text found in this PDF - it may be a scanned image with no real text layer. Try uploading it as a photo instead, so Gemini can read it directly.',
            'pdf_empty'
        );
    }
    return text;
};

const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
        // reader.result is "data:image/jpeg;base64,<data>" - only the
        // part after the comma is the real base64 payload Gemini's
        // inline_data field wants.
        const commaIndex = reader.result.indexOf(',');
        resolve(commaIndex >= 0 ? reader.result.slice(commaIndex + 1) : reader.result);
    };
    reader.onerror = () => reject(new SyllabusExtractionError('Could not read this image file.', 'file_read'));
    reader.readAsDataURL(file);
});

// The real structuring instruction shared by both input paths - the only
// difference between them is WHAT accompanies this prompt (extracted PDF
// text vs a raw image), not the schema being asked for.
//
// Also asks for real deadlines (assignments/exams) alongside units/topics
// now - a syllabus commonly states these explicitly (e.g. "Midterm: March
// 10", "Assignment 2 due April 3"), and extracting them here means they
// can be committed straight into the user's real assignment tracker
// alongside the topic structure, in the same one pass.
const STRUCTURE_PROMPT = `You are reading a college/school syllabus (from a PDF's extracted text, or directly from a photo of a physical page - read any visible text in the image first if one is provided). Structure it into units/topics, and separately list any real assignment or exam deadlines it states.

Return ONLY a JSON object, no other text, matching exactly this shape:
{
  "units": [{"name": "Unit 1: <real title from the document>", "topics": ["<topic 1>", "<topic 2>", ...]}, ...],
  "deadlines": [{"title": "<real assignment/exam name as written>", "type": "Assignment" or "Exam", "date": "YYYY-MM-DD"}, ...]
}

Rules:
- Use the document's own real unit/module names and numbering if present (e.g. "Unit 1", "Module 3", "Chapter 2") - do not invent generic names.
- Each topic should be a short, real topic/subtopic name as written or clearly implied in the document - do not pad the list with invented topics.
- If the document has no clear unit structure, group the real topics you can identify into one single unit named "Syllabus".
- Only include a deadline if the document states an actual date for it. Never guess or estimate a date that isn't genuinely written or unambiguously computable from the document (e.g. do not invent "the last week of the semester").
- "type" must be "Exam" for any test/midterm/final/quiz-with-a-fixed-date, and "Assignment" for anything else with a due date (homework, project, paper, presentation).
- If you cannot find any real syllabus content at all, return {"units": [], "deadlines": []}.
- Never fabricate units, topics, or deadlines that aren't genuinely present in the source.`;

// A real due date, genuinely stated in the document, is expected as
// "YYYY-MM-DD" per the prompt - but never trusted blindly. Anything that
// doesn't parse as a real calendar date is dropped rather than passed
// through, since a broken date string would silently corrupt sorting/
// "overdue" logic downstream in the assignment tracker.
const isValidIsoDate = (str) => typeof str === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(new Date(`${str}T00:00:00`).getTime());

// Parses and validates the AI's JSON response into the app's own real
// Unit/Topic (+ deadline) shape - genuinely checks the shape rather than
// trusting the model's output blindly (a real, if instructed, LLM can
// still return malformed or slightly-off JSON, or - despite the prompt -
// the OLD bare-array shape). Every id is generated fresh here, matching
// the exact id convention SyllabusPage.jsx's own addUnit/addTopic already
// use, so these rows are indistinguishable from manually-added ones once
// committed.
const parseAndValidate = (rawText) => {
    let parsed;
    try {
        parsed = JSON.parse(rawText);
    } catch (e) {
        // The model occasionally wraps JSON in a ```json fence despite the
        // instruction to return only JSON - one real, bounded fallback
        // attempt to strip that before giving up honestly.
        const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenced) {
            try { parsed = JSON.parse(fenced[1]); } catch (e2) { /* fall through to the honest error below */ }
        }
    }

    // Backward/defensive compatible: a bare array (the old prompt's shape,
    // or a provider that ignores the object instruction) is treated as
    // "units only, no deadlines" rather than rejected outright.
    const rawUnits = Array.isArray(parsed) ? parsed : parsed?.units;
    const rawDeadlines = Array.isArray(parsed) ? [] : parsed?.deadlines;

    if (!Array.isArray(rawUnits)) {
        throw new SyllabusExtractionError('The AI did not return a readable syllabus structure. Try a clearer photo or a different file.', 'parse_failed');
    }

    const now = Date.now();
    const units = rawUnits
        .filter((u) => u && typeof u.name === 'string' && u.name.trim())
        .map((u, unitIdx) => ({
            id: `unit_${now}_${unitIdx}_${Math.floor(Math.random() * 100000)}`,
            name: u.name.trim(),
            topics: Array.isArray(u.topics)
                ? u.topics
                    .filter((t) => typeof t === 'string' && t.trim())
                    .map((t, topicIdx) => ({
                        id: `topic_${now}_${unitIdx}_${topicIdx}_${Math.floor(Math.random() * 100000)}`,
                        name: t.trim(),
                        done: false,
                    }))
                : [],
        }));

    const deadlines = (Array.isArray(rawDeadlines) ? rawDeadlines : [])
        .filter((d) => d && typeof d.title === 'string' && d.title.trim() && isValidIsoDate(d.date))
        .map((d, idx) => ({
            id: `deadline_${now}_${idx}_${Math.floor(Math.random() * 100000)}`,
            title: d.title.trim(),
            type: d.type === 'Exam' ? 'Exam' : 'Assignment',
            date: d.date,
        }));

    return { units, deadlines };
};

// The one real entry point callers use. Returns { units, deadlines } ready
// for review (never auto-committed) - throws SyllabusExtractionError or
// the underlying AiProviderError/provider-specific error for any genuine
// failure, with a message meant to be shown to the user as-is.
export const extractSyllabusStructure = async ({ file, settings, signal }) => {
    const kind = classifySyllabusFile(file);
    if (kind === 'unsupported-doc') {
        throw new SyllabusExtractionError('Word documents (.doc/.docx) aren\'t supported yet - please export it as a PDF, or take a photo of the pages instead.', 'unsupported_format');
    }
    if (kind === 'unsupported') {
        throw new SyllabusExtractionError('Unsupported file type. Please upload a PDF or a photo (JPG/PNG) of the syllabus.', 'unsupported_format');
    }

    let promptText = STRUCTURE_PROMPT;
    let imagePart = null;

    if (kind === 'pdf') {
        const text = await extractTextFromPdf(file);
        promptText = `${STRUCTURE_PROMPT}\n\nDocument text:\n${text.slice(0, 20000)}`; // a real, generous cap - protects against an unusually large document blowing past a reasonable prompt size, not a meaningful loss for any real syllabus
    } else {
        const base64 = await fileToBase64(file);
        imagePart = { mimeType: file.type || 'image/jpeg', base64 };
    }

    let rawText;
    try {
        rawText = await generateStructuredJSON({ settings, promptText, imagePart, signal });
    } catch (e) {
        if (e instanceof AiProviderError) throw e; // already a real, user-facing message
        // Any provider-specific error (GeminiApiError/GrokApiError/
        // DeepseekApiError) also already carries a real, user-facing
        // message from that provider's own client - shown as-is.
        if (e.message) throw e;
        throw new SyllabusExtractionError('Something went wrong reading this file. Please try again.', 'unknown');
    }

    return parseAndValidate(rawText);
};
