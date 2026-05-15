const fs = require('fs');

// Read the js file
const ankiJs = fs.readFileSync('anki-export.js', 'utf8');

// Mock browser environment
global.document = {
    addEventListener: () => {},
    getElementById: () => ({ addEventListener: () => {}, disabled: false })
};
global.window = {};

// We will mock Genanki classes to intercept backHtml
let capturedHtml = '';
class MockModel { constructor(opts) { this.opts = opts; } }
class MockDeck { constructor() { this.notes = []; } addNote(n) { this.notes.push(n); } }
class MockNote {
    constructor(model, fields, tags, guid) {
        this.fields = fields;
        // fields[1] is backHtml
        capturedHtml = fields[1];
    }
}
class MockPackage { addDeck() {} writeToFile() {} }

global.Model = MockModel;
global.Deck = MockDeck;
global.Note = MockNote;
global.Package = MockPackage;
global.initSqlJs = async () => ({});
global.hashString = (str) => 123;

// Eval the file to put exportToAnki in scope
eval(ankiJs);

// Mock data
global.window.getSelectedLanguages = () => ({
    mainLang: 'pl',
    targets: [
        {lang: 'en', translation: true, examples: true},
        {lang: 'es', translation: true, examples: true}
    ]
});

const mockData = [
    {
        id: "1",
        _isGroup: true,
        root_pl: "jaki",
        _words: [
            {
                id: "1a",
                word_pl: "jaki",
                part_of_speech: "Pronoun",
                translation_en: "what kind of, which",
                example_1_pl: "Jaki kolor lubisz najbardziej?",
                example_1_en: "What color do you like the most?",
                example_2_pl: "Nie wiem, jaki film obejrzeć dzisiaj wieczorem.",
                example_2_en: "I don't know which movie to watch tonight."
            },
            {
                id: "1b",
                word_pl: "jaka",
                part_of_speech: "Pronoun",
                translation_en: "what kind of, which (feminine singular)",
                translation_es: "qué tipo de, cuál (femenino singular)",
                example_1_pl: "Jaka jest twoja ulubiona książka?",
                example_1_en: "What kind of book is your favorite?",
                example_2_pl: "Powiedz mi, jaka była twoja pierwsza praca.",
                example_2_en: "Tell me, what was your first job like."
            }
        ]
    }
];

exportToAnki(mockData, "Test Deck");

// Add basic styling wrapper to the captured HTML for rendering
const finalHtml = `
<html>
<head>
<style>
body { font-family: Arial, sans-serif; font-size: 20px; text-align: center; color: #e0e0e0; background-color: #202020; padding: 20px; }
.word { font-size: 36px; font-weight: bold; color: #3b82f6; margin-bottom: 5px; }
.sub-word { font-size: 20px; font-weight: bold; color: #e0e0e0; margin-bottom: 2px; }
.pos { font-size: 18px; font-weight: bold; color: #888; margin-bottom: 10px; }
.root { font-size: 18px; color: #aaa; margin-bottom: 15px; }
.translation { font-size: 22px; font-weight: bold; color: #e0e0e0; margin-bottom: 5px; }
.example-block { margin-top: 15px; margin-bottom: 15px; }
.example { font-size: 20px; font-weight: normal; margin-bottom: 3px; color: #e0e0e0; }
.example-trans { font-size: 18px; color: #aaa; font-style: italic; }
hr { border: 0; border-bottom: 1px solid #444; margin: 25px 0; }
.play-btn { background: #333; color: #fff; border: 1px solid #555; padding: 4px 12px; border-radius: 12px; cursor: pointer; font-size: 14px; margin-top: 5px; margin-bottom: 5px; display: inline-flex; align-items: center; justify-content: center; }
</style>
</head>
<body>
${capturedHtml}
</body>
</html>
`;

fs.writeFileSync('/home/jules/verification/backHtml.html', finalHtml);
console.log("Wrote HTML");
