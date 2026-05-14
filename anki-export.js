// Wait for everything to load, including sql.js
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

function exportToAnki(wordsArray, deckName) {
    const GenankiModel = typeof Model !== 'undefined' ? Model : (window.genanki ? window.genanki.Model : window.Model);
    const GenankiDeck = typeof Deck !== 'undefined' ? Deck : (window.genanki ? window.genanki.Deck : window.Deck);
    const GenankiNote = typeof Note !== 'undefined' ? Note : (window.genanki ? window.genanki.Note : window.Note);
    const GenankiPackage = typeof Package !== 'undefined' ? Package : (window.genanki ? window.genanki.Package : window.Package);

    const { mainLang, targets } = window.getSelectedLanguages();

    // Simplify the Model to just Front and Back
    const flds = [
        { name: 'Front' },
        { name: 'Back' }
    ];

    const qfmt = `<div class="word">{{Front}}</div>
{{tts ${mainLang}_${mainLang.toUpperCase()}:Front}}`;

    // The back template just renders the generic HTML we build in JS
    const afmt = `{{Back}}
<script>
function playAudio(text) {
    var msg = new SpeechSynthesisUtterance(text);
    msg.lang = '${mainLang}-${mainLang.toUpperCase()}';
    window.speechSynthesis.speak(msg);
}
</script>`;

    const MODEL_ID = 1690000003; // Bumping model ID since fields changed

    const model = new GenankiModel({
        name: `Dynamic Vocabulary Model ${mainLang.toUpperCase()} v2`,
        id: MODEL_ID.toString(),
        flds: flds,
        req: [[0, 'all', [0]]],
        tmpls: [{ name: 'Card 1', qfmt: qfmt, afmt: afmt }],
        css: `.card { font-family: Arial, sans-serif; font-size: 20px; text-align: center; color: #e0e0e0; background-color: #202020; padding: 20px; }
.word { font-size: 32px; font-weight: bold; color: #4b8ffd; margin-bottom: 5px; }
.sub-word { font-size: 24px; font-weight: bold; color: #e0e0e0; margin-bottom: 2px; }
.pos-gender { font-size: 14px; font-weight: bold; color: #888; margin-bottom: 10px; }
.root { font-size: 16px; color: #aaa; margin-bottom: 15px; }
.translation { font-size: 18px; font-weight: bold; color: #e0e0e0; margin-bottom: 5px; }
.example-block { margin-top: 15px; margin-bottom: 15px; }
.example { font-size: 18px; font-weight: 500; margin-bottom: 3px; }
.example-trans { font-size: 16px; color: #999; font-style: italic; }
hr { border: 0; border-bottom: 1px solid #444; margin: 25px 0; }
.play-btn { background: #333; color: #fff; border: 1px solid #555; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-top: 5px; margin-bottom: 5px; display: inline-flex; align-items: center; justify-content: center; }
.play-btn:hover { background: #444; }
.word-block { margin-bottom: 30px; }`
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
        let backHtml = `<div class="word">${frontText}</div>`;

        const root = groupObj[mainRootKey] || '';
        if (root) {
            backHtml += `<div class="root">Root: ${root}</div>`;
        }

        // Determine if we need to show multiple words, to separate them with HRs
        const isMultiWord = groupObj._words.length > 1;

        groupObj._words.forEach((w, index) => {
            if (isMultiWord) {
                backHtml += `<hr>`;
            } else {
                backHtml += `<div style="height: 15px;"></div>`;
            }

            backHtml += `<div class="word-block">`;
            backHtml += `<div class="sub-word">${w[mainWordKey]}</div>`;

            if (w.part_of_speech) {
                backHtml += `<div class="pos-gender">${w.part_of_speech}</div>`;
            }

            // Translations
            targets.forEach(t => {
                if (t.translation) {
                    const trans = w[`translation_${t.lang}`];
                    if (trans) {
                        backHtml += `<div class="translation">${t.lang.toUpperCase()}: ${trans}</div>`;
                    }
                }
            });

            // Examples
            // We look for any keys starting with example_ and group them by number
            const exampleNums = [1, 2]; // Typically 1 and 2

            exampleNums.forEach(num => {
                const mainEx = w[`example_${num}_${mainLang}`];
                if (mainEx) {
                    backHtml += `<div class="example-block">`;
                    // The main language example + audio button
                    // Note: We safely escape quotes for the onclick handler
                    const safeMainEx = mainEx.replace(/'/g, "\\'");
                    backHtml += `<div class="example">${mainEx}</div>`;
                    backHtml += `<button class="play-btn" onclick="playAudio('${safeMainEx}')">▶ Play Audio</button>`;

                    // The target language translations of this example
                    targets.forEach(t => {
                        if (t.examples) {
                            const tgtEx = w[`example_${num}_${t.lang}`];
                            if (tgtEx) {
                                backHtml += `<div class="example-trans">${tgtEx}</div>`;
                            }
                        }
                    });

                    backHtml += `</div>`;
                }
            });

            backHtml += `</div>`; // Close word-block
        });

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
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    // Make it positive and large enough
    return Math.abs(hash) + 1690000000;
}
