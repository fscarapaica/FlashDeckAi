
// Ensure genanki namespace exists to prevent reference errors, accommodating both UMD and global class setups
if (typeof window.genanki === 'undefined') {
    window.genanki = {
        Model: typeof Model !== 'undefined' ? Model : null,
        Deck: typeof Deck !== 'undefined' ? Deck : null,
        Note: typeof Note !== 'undefined' ? Note : null,
        Package: typeof Package !== 'undefined' ? Package : null
    };
}
// Wait for everything to load, including genanki, sql.js, jszip, etc.
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


// Ensure genanki namespace exists for compatibility with existing export logic
if (typeof window.genanki === 'undefined') {
    window.genanki = {
        Model: typeof Model !== 'undefined' ? Model : null,
        Deck: typeof Deck !== 'undefined' ? Deck : null,
        Note: typeof Note !== 'undefined' ? Note : null,
        Package: typeof Package !== 'undefined' ? Package : null
    };
}

function exportToAnki(wordsArray, deckName) {
    // 1. Define the Model
    // We need a stable Model ID for Anki to recognize the note type.
    const MODEL_ID = 1690000001;

            const model = new window.genanki.Model({
        name: 'Polish Vocabulary Model v2',
        id: MODEL_ID.toString(),
        flds: [
            { name: 'Word' },
            { name: 'Root' },
            { name: 'RootTranslation' },
            { name: 'PartOfSpeech' },
            { name: 'TranslationEN' },
            { name: 'TranslationES' },
            { name: 'Example1_PL' },
            { name: 'Example1_EN' },
            { name: 'Example2_PL' },
            { name: 'Example2_EN' }
        ],
        req: [
            [0, 'all', [0]]
        ],
        tmpls: [
            {
                name: 'Card 1',
                qfmt: `<div class="word">{{Word}}</div>
{{tts pl_PL:Word}}`,
                afmt: `<div class="word">{{Word}}</div>
<div class="pos-gender">{{PartOfSpeech}}</div>
<div class="root">Root: {{Root}} | {{RootTranslation}}</div>
<div class="translation-en">🇬🇧 {{TranslationEN}}</div>
<div class="translation-es">🇪🇸 {{TranslationES}}</div>
<hr>
<div class="example">{{Example1_PL}}</div>
{{tts pl_PL:Example1_PL}}
<div class="example-trans">🇬🇧 {{Example1_EN}}</div>
<hr>
<div class="example">{{Example2_PL}}</div>
{{tts pl_PL:Example2_PL}}
<div class="example-trans">🇬🇧 {{Example2_EN}}</div>`
            }
        ],
        css: `.card {
            font-family: Arial, sans-serif;
            font-size: 20px;
            text-align: left;
            color: #202020;
            background-color: #f9f9f9;
            padding: 20px;
        }
        .word { font-size: 32px; font-weight: bold; color: #1a56db; margin-bottom: 5px; }
        .pos-gender { font-size: 16px; font-weight: bold; color: #555; margin-bottom: 10px; }
        .root { font-size: 16px; color: #555; margin-bottom: 15px; }
        .translation-en { font-size: 22px; font-weight: bold; color: #202020; margin-bottom: 5px; }
        .translation-es { font-size: 20px; color: #444; margin-bottom: 15px; }
        .example { font-size: 20px; margin-top: 15px; font-weight: 500; }
        .example-trans { font-size: 16px; color: #666; font-style: italic; margin-top: 3px; }
        hr { border: 0; border-bottom: 1px solid #ccc; margin: 20px 0; }`
    });

    // 2. Define the Deck
    // Generate a consistent Deck ID based on the name so it updates existing deck
    const DECK_ID = hashString(deckName);

    const deck = new window.genanki.Deck(DECK_ID.toString(), deckName);

    // 3. Add Notes (Cards) to the Deck
    wordsArray.forEach(wordObj => {
        // We use the unique 'id' from our state as the GUID so Anki knows it's the same card if updated
        const note = new window.genanki.Note({
            model: model,
            fields: [
                wordObj.word_pl || '',
                wordObj.root_pl || '',
                wordObj.root_translation_en || '',
                wordObj.part_of_speech || '',
                wordObj.translation_en || '',
                wordObj.translation_es || '',
                wordObj.example_1_pl || '',
                wordObj.example_1_en || '',
                wordObj.example_2_pl || '',
                wordObj.example_2_en || ''
            ],
            guid: wordObj.id // Preserving ID to prevent duplicates
        });
        deck.addNote(note);
    });

    // 4. Create Package and Export
    const pkg = new window.genanki.Package();
    pkg.addDeck(deck);

    // Save to file
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