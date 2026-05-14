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
    // Safely resolve Anki classes whether they are globally available or in a 'genanki' namespace
    const GenankiModel = typeof Model !== 'undefined' ? Model : (window.genanki ? window.genanki.Model : window.Model);
    const GenankiDeck = typeof Deck !== 'undefined' ? Deck : (window.genanki ? window.genanki.Deck : window.Deck);
    const GenankiNote = typeof Note !== 'undefined' ? Note : (window.genanki ? window.genanki.Note : window.Note);
    const GenankiPackage = typeof Package !== 'undefined' ? Package : (window.genanki ? window.genanki.Package : window.Package);

    const { mainLang, targets } = window.getSelectedLanguages();

    // Dynamically build fields
    const flds = [
        { name: 'Word' },
        { name: 'Root' },
        { name: 'PartOfSpeech' }
    ];

    targets.forEach(t => {
        if (t.translation) {
            flds.push({ name: `Translation_${t.lang.toUpperCase()}` });
        }
        if (t.examples) {
            flds.push({ name: `Example1_${mainLang.toUpperCase()}` });
            flds.push({ name: `Example1_${t.lang.toUpperCase()}` });
            flds.push({ name: `Example2_${mainLang.toUpperCase()}` });
            flds.push({ name: `Example2_${t.lang.toUpperCase()}` });
        }
    });

    // Remove duplicate example keys from flds (since multiple target languages might add the same main language example)
    const uniqueFlds = [];
    const seenNames = new Set();
    flds.forEach(f => {
        if (!seenNames.has(f.name)) {
            seenNames.add(f.name);
            uniqueFlds.push(f);
        }
    });

    // Build qfmt and afmt
    const qfmt = `<div class="word">{{Word}}</div>
{{tts ${mainLang}_${mainLang.toUpperCase()}:Word}}`;

    let afmt = `<div class="word">{{Word}}</div>
<div class="pos-gender">{{PartOfSpeech}}</div>
<div class="root">Root: {{Root}}</div>`;

    targets.forEach(t => {
        if (t.translation) {
            afmt += `
<div class="translation-${t.lang}">${t.lang.toUpperCase()}: {{Translation_${t.lang.toUpperCase()}}}</div>`;
        }
    });

    // We will use JS for the back side audio to avoid autoplay
    let hasExamples = false;
    [1, 2].forEach(num => {
        const exMainKey = `Example${num}_${mainLang.toUpperCase()}`;
        if (uniqueFlds.find(f => f.name === exMainKey)) {
            hasExamples = true;
            afmt += `
<hr>
<div class="example" id="ex${num}">{{${exMainKey}}}</div>`;
            afmt += `
<button class="play-btn" onclick="playAudio('ex${num}')">▶ Play Audio</button>`;

            targets.forEach(t => {
                if (t.examples) {
                    const exTgtKey = `Example${num}_${t.lang.toUpperCase()}`;
                    if (uniqueFlds.find(f => f.name === exTgtKey)) {
                        afmt += `
<div class="example-trans">{{${exTgtKey}}}</div>`;
                    }
                }
            });
        }
    });

    if (hasExamples) {
        afmt += `
<script>
function playAudio(elementId) {
    var text = document.getElementById(elementId).innerText;
    var msg = new SpeechSynthesisUtterance(text);
    msg.lang = '${mainLang}-${mainLang.toUpperCase()}';
    window.speechSynthesis.speak(msg);
}
</script>`;
    }

    const MODEL_ID = 1690000002;

    const model = new GenankiModel({
        name: `Dynamic Vocabulary Model ${mainLang.toUpperCase()}`,
        id: MODEL_ID.toString(),
        flds: uniqueFlds,
        req: [[0, 'all', [0]]],
        tmpls: [{ name: 'Card 1', qfmt: qfmt, afmt: afmt }],
        css: `.card { font-family: Arial, sans-serif; font-size: 20px; text-align: center; color: #e0e0e0; background-color: #202020; padding: 20px; }
.word { font-size: 32px; font-weight: bold; color: #4b8ffd; margin-bottom: 5px; }
.pos-gender { font-size: 16px; font-weight: bold; color: #aaa; margin-bottom: 10px; }
.root { font-size: 16px; color: #aaa; margin-bottom: 15px; }
[class^="translation-"] { font-size: 20px; font-weight: bold; color: #e0e0e0; margin-bottom: 5px; }
.example { font-size: 20px; margin-top: 15px; font-weight: 500; }
.example-trans { font-size: 16px; color: #999; font-style: italic; margin-top: 3px; }
hr { border: 0; border-bottom: 1px solid #444; margin: 20px 0; }
.play-btn { background: #333; color: #fff; border: 1px solid #555; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 14px; margin-top: 5px; }
.play-btn:hover { background: #444; }`
    });

    const DECK_ID = hashString(deckName);
    const deck = new GenankiDeck(DECK_ID.toString(), deckName);

    wordsArray.forEach(groupObj => {
        if (!groupObj._isGroup || !groupObj._words || groupObj._words.length === 0) return;

        const mainWordKey = `word_${mainLang}`;
        const mainRootKey = `root_${mainLang}`;

        const fieldValues = [];

        uniqueFlds.forEach(field => {
            const fName = field.name;

            if (fName === 'Word') {
                fieldValues.push(groupObj._words.map(w => w[mainWordKey]).join(', '));
            } else if (fName === 'Root') {
                fieldValues.push(groupObj[mainRootKey] || '');
            } else if (fName === 'PartOfSpeech') {
                const posSet = new Set(groupObj._words.map(w => w.part_of_speech).filter(Boolean));
                fieldValues.push(Array.from(posSet).join(', '));
            } else if (fName.startsWith('Translation_')) {
                const lang = fName.split('_')[1].toLowerCase();
                const transKey = `translation_${lang}`;
                let aggregatedTrans = groupObj._words.map(w => {
                    const trans = w[transKey] || '';
                    if (!trans) return '';
                    return groupObj._words.length > 1 ? `<b>${w[mainWordKey]}</b>: ${trans}` : trans;
                }).filter(Boolean).join('<br><br>');
                fieldValues.push(aggregatedTrans);
            } else if (fName.startsWith('Example')) {
                // Example1_EN, Example2_PL, etc.
                const parts = fName.split('_');
                const exNum = parts[0].replace('Example', ''); // '1' or '2'
                const lang = parts[1].toLowerCase(); // 'en' or 'pl'

                const exKey = `example_${exNum}_${lang}`;
                let aggregatedEx = groupObj._words.map(w => {
                    const ex = w[exKey] || '';
                    if (!ex) return '';
                    return groupObj._words.length > 1 ? `<b>${w[mainWordKey]}</b>: <br>${ex}` : ex;
                }).filter(Boolean).join('<br><br>');
                fieldValues.push(aggregatedEx);
            } else {
                fieldValues.push('');
            }
        });

        // Correct initialization of Note class using positional arguments for genanki-js
        const note = new GenankiNote(
            model,
            fieldValues,
            null, // tags (optional)
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
