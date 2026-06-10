/* global document, window, Model, Deck, Note, Package, initSqlJs */
// Wait for everything to load, including sql.js
if (typeof document !== 'undefined') {
document.addEventListener('DOMContentLoaded', () => {

    const exportAnkiBtn = document.getElementById('export-anki-btn');
    let SQL;

    // Initialize sql.js (required by genanki-js)
    const config = {
        locateFile: filename => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.wasm`
    };

    initSqlJs(config).then(function (sql) {
        SQL = sql;
        // Make SQL globally available as required by genanki.js
        window.SQL = SQL;
        exportAnkiBtn.disabled = false;
    }).catch(err => {
        console.error("Failed to load sql.js", err);
        document.getElementById('status-message').textContent = "Failed to load export dependencies. Check your internet connection.";
        document.getElementById('status-message').classList.remove('hidden');
        document.getElementById('status-message').classList.add('text-red-600');
    });

    exportAnkiBtn.addEventListener('click', () => {
        const words = window.getStagedWords();
        const deckName = window.getDeckName();
        const statusMessage = document.getElementById('status-message');

        const showExportError = (msg) => {
            statusMessage.textContent = msg;
            statusMessage.classList.remove('hidden', 'text-green-600', 'text-blue-600');
            statusMessage.classList.add('text-red-600');
            setTimeout(() => statusMessage.classList.add('hidden'), 5000);
        };

        if (words.length === 0) {
            showExportError('No words to export. Please generate some words first.');
            return;
        }

        try {
            exportToAnki(words, deckName);
        } catch (e) {
            console.error(e);
            showExportError("Error exporting Anki deck: " + e.message);
        }
    });

});
}

function exportToAnki(wordsArray, deckName) {
    const GenankiModel = typeof Model !== 'undefined' ? Model : (window.genanki ? window.genanki.Model : window.Model);
    const GenankiDeck = typeof Deck !== 'undefined' ? Deck : (window.genanki ? window.genanki.Deck : window.Deck);
    const GenankiNote = typeof Note !== 'undefined' ? Note : (window.genanki ? window.genanki.Note : window.Note);
    const GenankiPackage = typeof Package !== 'undefined' ? Package : (window.genanki ? window.genanki.Package : window.Package);

    const { mainLang, targets } = window.getSelectedLanguages();

    // Pre-filter and map targets for faster inner loops
    const translationTargets = [];
    const exampleTargets = [];
    for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        if (t.translation) {
            translationTargets.push({
                lang: t.lang,
                upperLang: t.lang.toUpperCase(),
                transKey: `translation_${t.lang}`
            });
        }
        if (t.examples) {
            exampleTargets.push({
                lang: t.lang
            });
        }
    }

    // Simplify the Model to just Front and Back
    const flds = [
        { name: 'Front' },
        { name: 'Back' }
    ];

    const qfmt = `<div class="word-front">{{Front}}</div>
{{tts ${mainLang}_${mainLang.toUpperCase()}:Front}}`;

    const ttsSpeed = window.getTtsSpeed ? window.getTtsSpeed() : 1.0;

    // The back template just renders the generic HTML we build in JS
    const afmt = `{{Back}}
<script>
var ankiDroidApi = null;
if (typeof AnkiDroidJS !== 'undefined') {
    try {
        ankiDroidApi = new AnkiDroidJS({ version: "0.0.3", developer: "fscarapaica@gmail.com" });
    } catch(e) {}
}

function playAudio(text) {
    if (ankiDroidApi) {
        try {
            ankiDroidApi.ankiTtsSetLanguage('${mainLang}-${mainLang.toUpperCase()}');
            ankiDroidApi.ankiTtsSetSpeechRate(${ttsSpeed});
            ankiDroidApi.ankiTtsSpeak(text);
            return;
        } catch(e) {}
    }

    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    msg.lang = '${mainLang}-${mainLang.toUpperCase()}';
    msg.rate = ${ttsSpeed};
    window.speechSynthesis.speak(msg);
}
</script>`;

    const MODEL_ID = 1690000005; // Bumping model ID since fields/styles changed

    const model = new GenankiModel({
        name: `Dynamic Vocabulary Model ${mainLang.toUpperCase()} v4`,
        id: MODEL_ID.toString(),
        flds: flds,
        req: [[0, 'all', [0]]],
        tmpls: [{ name: 'Card 1', qfmt: qfmt, afmt: afmt }],
        css: `.card { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; text-align: center; color: #FAFAFA; background-color: #09090B; padding: 20px; display: flex; flex-direction: column; justify-content: flex-start; min-height: 100vh; margin: 0; box-sizing: border-box; }
.word-front { font-size: 48px; font-weight: bold; color: #3b82f6; margin-bottom: 5px; letter-spacing: -0.02em; }
.word-back { font-size: 38px; font-weight: bold; color: #3b82f6; margin-bottom: 5px; letter-spacing: -0.02em; }
.root-badge { display: inline-block; background: #27272A; border-radius: 12px; padding: 3px 10px; font-size: 13px; font-weight: bold; color: #FAFAFA; margin-bottom: 10px; border: 1px solid #3F3F46; }
.root-badge-label { color: #888; font-size: 11px; margin-right: 4px; }
.sub-word { font-size: 20px; font-weight: bold; color: #3b82f6; margin-bottom: 5px; }
.pos-container { display: flex; flex-direction: column; align-items: center; justify-content: center; margin-bottom: 10px; gap: 6px; }
.pos { background: #3F3F46; color: #E4E4E7; border-radius: 4px; padding: 2px 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; display: inline-block; }
.tags-container { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
.tag-badge { background: #3F3F46; color: #E4E4E7; border-radius: 4px; padding: 2px 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
.translation { font-size: 18px; font-weight: bold; color: #FAFAFA; margin-bottom: 5px; }
.example-block { margin-top: 20px; margin-bottom: 20px; }
.example { font-size: 18px; font-weight: 500; margin-bottom: 10px; color: #FAFAFA; line-height: 1.4; }
.example-trans { font-size: 16px; color: #A1A1AA; font-style: normal; margin-top: 10px; line-height: 1.4; }
hr { border: 0; border-bottom: 1px solid #27272A; margin: 15px 0; }
.play-btn { background: #18181B; color: #FAFAFA; border: 1px solid #3F3F46; padding: 8px 16px; border-radius: 16px; cursor: pointer; font-size: 14px; font-weight: 500; display: inline-flex; align-items: center; justify-content: center; transition: background 0.2s; }
.play-btn:hover { background: #27272A; }
.play-btn svg { width: 16px; height: 16px; margin-right: 8px; fill: currentColor; }
.play-btn-example { margin-bottom: 10px; }
.example-hr { border: 0; border-bottom: 1px dashed #3F3F46; margin: 15px 0; width: 60%; margin-left: auto; margin-right: auto; }
.play-btn-front { background: #27272A; color: #FAFAFA; border: none; padding: 12px; border-radius: 16px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: background 0.2s; }
.play-btn-front:hover { background: #3F3F46; }
.play-btn-front svg { width: 24px; height: 24px; fill: currentColor; }
.word-block { background: #18181B; border: 1px solid #27272A; border-radius: 8px; padding: 24px; margin-bottom: 20px; text-align: center; }`
    });

    const DECK_ID = hashString(deckName);
    const deck = new GenankiDeck(DECK_ID.toString(), deckName);

    wordsArray.forEach(groupObj => {
        if (!groupObj._isGroup || !groupObj._words || groupObj._words.length === 0) return;

        const mainWordKey = `word_${mainLang}`;
        const mainRootKey = `root_${mainLang}`;

        // FRONT: Comma separated list of all words
        const frontText = groupObj._words.map(w => w[mainWordKey]).join(', ');

        // BACK: Build HTML chunks per word
        let backHtml = `<div class="word-back">${frontText}</div>`;

        // Extract shared info from first word (Assuming group shares root and POS)
        const root = groupObj[mainRootKey] || groupObj._words[0][mainRootKey] || '';

        if (root) {
            backHtml += `<div class="root-badge"><span class="root-badge-label">ROOT:</span> ${root}</div>`;
        }

        // Iterate through each specific word form in the group
        // Add an HR immediately after the root section if there are words to show
        if (groupObj._words.length > 0 && root) {
            backHtml += `<hr>`;
        }

        for (let i = 0; i < groupObj._words.length; i++) {
             const w = groupObj._words[i];
             const pos = w.part_of_speech || groupObj._words[0].part_of_speech || '';

             backHtml += `<div class="word-block">`;

             backHtml += `<div class="sub-word">${w[mainWordKey]}</div>`;

             backHtml += `<div class="pos-container">`;
             if (pos) {
                 backHtml += `<div class="pos">${pos}</div>`;
             }
             backHtml += `</div>`;

             // Translations for this specific word
             for (let k = 0; k < translationTargets.length; k++) {
                 const t = translationTargets[k];
                 const trans = w[t.transKey];
                 if (trans) {
                     backHtml += `<div class="translation">${t.upperLang}: ${trans}</div>`;
                 }
             }

             // Examples for this specific word
             const maxExamples = 2;
             let exampleCount = 0;
             for (let num = 1; num <= maxExamples; num++) {
                 const mainEx = w[`example_${num}_${mainLang}`];
                 if (mainEx) {
                    if (exampleCount > 0) {
                        backHtml += `<hr class="example-hr">`;
                    }
                    backHtml += `<div class="example-block">`;

                    // Audio Button for example
                    const safeMainEx = mainEx.replace(/'/g, "\\'");
                    backHtml += `<button class="play-btn play-btn-example" onclick="playAudio('${safeMainEx}')">
                        <svg viewBox="0 0 24 24"><path d="M13 5v14l8-7z M3 9v6h4l5 5V4L7 9z"/></svg> Play Audio
                    </button>`;

                    backHtml += `<div class="example">Example ${num}: ${mainEx}</div>`;

                    // Example Translations
                    for (let k = 0; k < exampleTargets.length; k++) {
                        const tgtEx = w[`example_${num}_${exampleTargets[k].lang}`];
                        if (tgtEx) {
                            backHtml += `<div class="example-trans">${tgtEx}</div>`;
                        }
                    }

                    backHtml += `</div>`; // example-block
                    exampleCount++;
                 }
             }

             // Tags
             if (w.tags && w.tags.length > 0) {
                 backHtml += `<div class="tags-container" style="margin-top: 20px;">`;
                 w.tags.forEach(tag => {
                     backHtml += `<span class="tag-badge">${tag}</span>`;
                 });
                 backHtml += `</div>`;
             }

             backHtml += `</div>`; // word-block
        }

        const note = new GenankiNote(
            model,
            [frontText, backHtml],
            null, // tags
            groupObj.id // guid
        );
        deck.addNote(note);
    });

    const pkg = new GenankiPackage();
    pkg.addDeck(deck);

    const filename = `${deckName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.apkg`;
    pkg.writeToFile(filename);
}

// Simple string hash function to generate a consistent Deck ID
function hashString(str) {
    let hash = 0;
    const len = str.length;
    for (let i = 0; i < len; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    // Make it positive and large enough
    return Math.abs(hash) + 1690000000;
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { hashString, exportToAnki };
}
