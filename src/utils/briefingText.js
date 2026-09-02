// src/utils/briefingText.js
//
// Real, hand-written translations for the AI Daily Briefing's spoken/
// typed summary - English, Hindi (Devanagari), and Hinglish (romanized,
// code-mixed) - shared between useDailyBriefing.js (which builds the
// real briefing from live app data) and SettingsPage.jsx (which uses
// the same builder with sample numbers for the voice "Test" button, so
// the preview genuinely sounds like the real thing instead of a
// generic placeholder sentence).
//
// Deliberately static templates, not a live LLM call - the whole point
// of this card is that it works with zero AI configuration, for every
// user regardless of whether they've added a Gemini/OpenAI key. A live
// translation call would make Hindi/Hinglish playback silently stop
// working the moment a key expires or a request fails.

const GREETINGS = {
    en: { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening', night: 'Good night' },
    hi: { morning: 'सुप्रभात', afternoon: 'शुभ दोपहर', evening: 'शुभ संध्या', night: 'शुभ रात्रि' },
    hinglish: { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening', night: 'Good night' },
};

export const getGreetingKey = (hour = new Date().getHours()) => {
    if (hour >= 4 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
};

// lang: 'en' | 'hi' | 'hinglish'. Every field below mirrors
// useDailyBriefing.js's own real data shape exactly, so the caller
// passes real numbers there and can pass fabricated sample numbers here
// for a settings preview without either one needing its own copy of
// this sentence logic.
export const buildBriefingSentences = (lang, {
    userName, pendingToday, gymStatus, dietStatus, monthlyBudgetCap, budgetRemaining, currency,
}) => {
    const greetingKey = getGreetingKey();
    const greeting = (GREETINGS[lang] || GREETINGS.en)[greetingKey];
    const sentences = [];

    if (lang === 'hi') {
        sentences.push(`${greeting}${userName ? `, ${userName}` : ''}।`);
        sentences.push(pendingToday === 0
            ? 'आज आपका शेड्यूल एकदम खाली है - प्लानर या आज की टाइमटेबल में कुछ भी पेंडिंग नहीं है।'
            : `आज आपके प्लानर और शेड्यूल में ${pendingToday} टास्क पेंडिंग ${pendingToday === 1 ? 'है' : 'हैं'}।`);
        if (gymStatus?.hasPlan) {
            sentences.push(gymStatus.loggedToday
                ? `आज की ${gymStatus.planName} वर्कआउट पहले से लॉग हो चुकी है - बहुत बढ़िया!`
                : `आपका ${gymStatus.planName} स्प्लिट एक्टिव है, लेकिन आज की वर्कआउट अभी लॉग नहीं हुई है।`);
        }
        if (dietStatus?.total > 0) {
            sentences.push(`आपने आज ${dietStatus.total} में से ${dietStatus.logged} मील्स लॉग की हैं।`);
        }
        if (monthlyBudgetCap > 0) {
            sentences.push(`इस महीने के बजट में आपके पास ${currency}${Math.round(budgetRemaining).toLocaleString()} बचे हैं।`);
        }
    } else if (lang === 'hinglish') {
        sentences.push(`${greeting}${userName ? `, ${userName}` : ''}!`);
        sentences.push(pendingToday === 0
            ? "Aaj aapka schedule bilkul clear hai - Planner ya aaj ke timetable mein kuch bhi pending nahi hai."
            : `Aaj aapke Planner aur schedule mein ${pendingToday} task pending ${pendingToday === 1 ? 'hai' : 'hain'}.`);
        if (gymStatus?.hasPlan) {
            sentences.push(gymStatus.loggedToday
                ? `Aaj ka ${gymStatus.planName} workout already log ho chuka hai - bahut badhiya!`
                : `Aapka ${gymStatus.planName} split active hai, lekin aaj ka workout abhi tak log nahi hua hai.`);
        }
        if (dietStatus?.total > 0) {
            sentences.push(`Aapne aaj ${dietStatus.total} mein se ${dietStatus.logged} meals log ki hain.`);
        }
        if (monthlyBudgetCap > 0) {
            sentences.push(`Is mahine ke budget mein aapke paas ${currency}${Math.round(budgetRemaining).toLocaleString()} bache hain.`);
        }
    } else {
        sentences.push(`${greeting}${userName ? `, ${userName}` : ''}.`);
        sentences.push(pendingToday === 0
            ? "You have a clear schedule today - nothing pending in Planner or today's timetable."
            : `You have ${pendingToday} task${pendingToday === 1 ? '' : 's'} pending today across your planner and schedule.`);
        if (gymStatus?.hasPlan) {
            sentences.push(gymStatus.loggedToday
                ? `Today's ${gymStatus.planName} workout is already logged - nice work.`
                : `Your ${gymStatus.planName} split is active, but today's workout isn't logged yet.`);
        }
        if (dietStatus?.total > 0) {
            sentences.push(`You've logged ${dietStatus.logged} of ${dietStatus.total} meals today.`);
        }
        if (monthlyBudgetCap > 0) {
            sentences.push(`You have ${currency}${Math.round(budgetRemaining).toLocaleString()} left in this month's budget.`);
        }
    }

    return sentences;
};

// BCP-47 language tag SpeechSynthesisUtterance.lang should be set to for
// each option - used for the utterance itself, so the OS's own TTS
// engine pronounces the text with the right phonetic rules instead of
// silently defaulting to whatever the browser's own global default
// happens to be. Two genuinely independent controls now, per explicit
// correction - Language decides which of the three real sentence sets
// above is used; Voice (see curateVoices below) only decides which
// installed voice reads whichever text that turns out to be. Picking a
// Hindi-named voice does NOT switch the language on its own anymore -
// that coupling was the actual bug just reported (a real Hindi/Korean/
// etc. voice silently swapping the text language whenever it happened
// to be selected, with no separate way to just pick a voice character
// - a smooth-sounding male/female voice - without also changing what
// language gets spoken).
export const LANG_TAGS = { en: 'en-IN', hi: 'hi-IN', hinglish: 'en-IN' };

// A real, stable, well-documented list of Apple's own "novelty"/joke
// system voices (Bad News, Bells, Zarvox, and the rest of that same
// catalog) - genuinely not what "the best voices" means, but they
// alphabetize ahead of the real, standard ones (Samantha, Daniel,
// Karen, Rishi, Lekha, Veena, ...) that a device also always ships, so
// a plain alphabetical cap surfaces exactly the wrong dozen. Named and
// excluded explicitly rather than guessed at with a quality score
// nothing in this API actually provides.
const NOVELTY_VOICE_NAMES = new Set([
    'Albert', 'Bad News', 'Bahh', 'Bells', 'Boing', 'Bubbles', 'Cellos',
    'Deranged', 'Eddy', 'Flo', 'Good News', 'Grandma', 'Grandpa',
    'Hysterical', 'Jester', 'Junior', 'Kathy', 'Organ', 'Pipe Organ',
    'Princess', 'Quirky', 'Ralph', 'Reed', 'Rocko', 'Sandy', 'Shelley',
    'Superstar', 'Trinoids', 'Whisper', 'Wobble', 'Zarvox', 'Fred',
]);

// A device can genuinely report 100+ installed system voices - most of
// them entirely unrelated languages (French, Korean, Swedish, ...) that
// have no place in a 3-language (English/Hindi/Hinglish) picker and,
// per a real, confirmed report, could even end up selected by mistake
// out of that huge list, "speaking in Korean" with no obvious reason
// why. This filters down to only the voices actually relevant here
// (English or Hindi language tags), drops the known novelty ones, then
// caps the result at a real, manageable shortlist - not just a "top 10
// by whatever order the OS happened to report them in", but genuinely
// deduplicated by name and capped so this list stays actually browsable.
// Some platforms report a novelty voice's own name with a language
// suffix attached ("Eddy (English (United Kingdom))"), not the bare
// name alone - matched by its own leading word here rather than an
// exact Set lookup, so that variant is still correctly caught.
const isNoveltyVoice = (name) => NOVELTY_VOICE_NAMES.has((name || '').split(' (')[0].trim());

// Chrome (and Chromium browsers) expose two genuinely different families
// of voice under the same speechSynthesis API: the device's own local
// system voices (Lekha, Daniel, Samantha, Karen, Rishi, ...) synthesized
// entirely on-device, and a small set of "Google ..." - prefixed voices
// (Google हिन्दी, Google UK English Female/Male, Google US English, ...)
// that are streamed from Google's own cloud TTS engine. Sorted first
// within their language group below since they were a genuine, reported
// quality win over most local voices at the time - but no longer
// excluding local voices outright the way an earlier version here did:
// a later, direct re-test reported that same small Google-only shortlist
// ALL sounding flat/robotic ("GPS voice"), with too few real
// alternatives to try - so both pools are merged now, keeping Google
// voices as the default suggestion (still first) rather than the only
// option, and lifting the cap so a genuinely wider set (up to 15) is
// actually reachable, not just a few Google ones plus nothing else.
const isGoogleVoice = (name) => /^google\s/i.test((name || '').trim());

export const MAX_VOICE_CHOICES = 15;
export const curateVoices = (allVoices) => {
    const relevant = (allVoices || []).filter((v) => /^(en|hi)/i.test(v.lang) && !isNoveltyVoice(v.name));
    const seenNames = new Set();
    const deduped = relevant.filter((v) => {
        if (seenNames.has(v.name)) return false;
        seenNames.add(v.name);
        return true;
    });
    deduped.sort((a, b) => {
        const aHi = a.lang.toLowerCase().startsWith('hi') ? 0 : 1;
        const bHi = b.lang.toLowerCase().startsWith('hi') ? 0 : 1;
        if (aHi !== bHi) return aHi - bHi;
        const aGoogle = isGoogleVoice(a.name) ? 0 : 1;
        const bGoogle = isGoogleVoice(b.name) ? 0 : 1;
        if (aGoogle !== bGoogle) return aGoogle - bGoogle;
        return a.name.localeCompare(b.name);
    });
    return deduped.slice(0, MAX_VOICE_CHOICES);
};
