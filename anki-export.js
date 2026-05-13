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

function exportToAnki(wordsArray, deckName) {
    // 1. Define the Model
    // We need a stable Model ID for Anki to recognize the note type.
    const MODEL_ID = 1690000001;

    const model = new genanki.Model({
        name: 'Polish Vocabulary Model',
        id: MODEL_ID.toString(),
        flds: [
            { name: 'Word' },
            { name: 'Root' },
            { name: 'Translation' },
            { name: 'Example1_PL' },
            { name: 'Example1_EN' },
            { name: 'Example2_PL' },
            { name: 'Example2_EN' }
        ],
        req: [
            [0, 'all', [0]] // Require 'Word' field
        ],
        tmpls: [
            {
                name: 'Card 1',
                qfmt: `<div class="word">{{Word}}</div>\n{{tts pl_PL:Word}}`,
                afmt: `<div class="root">Root: {{Root}}</div>
<div class="translation">{{Translation}}</div>
<hr>
<div class="example">{{Example1_PL}}</div>
{{tts pl_PL:Example1_PL}}
<div class="example-en">{{Example1_EN}}</div>
<hr>
<div class="example">{{Example2_PL}}</div>
{{tts pl_PL:Example2_PL}}
<div class="example-en">{{Example2_EN}}</div>`
            }
        ],
        css: `.card {
            font-family: arial;
            font-size: 20px;
            text-align: center;
            color: black;
            background-color: white;
        }
        .word { font-size: 32px; font-weight: bold; margin-bottom: 10px; }
        .root { font-size: 18px; color: #555; }
        .translation { font-size: 24px; color: #0056b3; margin-bottom: 15px; }
        .example { font-size: 20px; margin-top: 10px; }
        .example-en { font-size: 16px; color: #666; font-style: italic; }
        hr { margin: 20px auto; width: 80%; }`
    });

    // 2. Define the Deck
    // Generate a consistent Deck ID based on the name so it updates existing deck
    const DECK_ID = hashString(deckName);

    const deck = new genanki.Deck(DECK_ID.toString(), deckName);

    // 3. Add Notes (Cards) to the Deck
    wordsArray.forEach(wordObj => {
        // We use the unique 'id' from our state as the GUID so Anki knows it's the same card if updated
        const note = new genanki.Note({
            model: model,
            fields: [
                wordObj.word_pl || '',
                wordObj.root_pl || '',
                wordObj.translation_en || '',
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
    const pkg = new genanki.Package();
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