const test = require('node:test');
const assert = require('node:assert');
const { hashString, exportToAnki } = require('./anki-export.js');

test('hashString', async (t) => {
    await t.test('generates consistent hash for same string', () => {
        const hash1 = hashString('My Deck');
        const hash2 = hashString('My Deck');
        assert.strictEqual(hash1, hash2);
    });

    await t.test('generates different hash for different strings', () => {
        const hash1 = hashString('Deck A');
        const hash2 = hashString('Deck B');
        assert.notStrictEqual(hash1, hash2);
    });

    await t.test('returns integer greater than or equal to 1690000000', () => {
        const hash = hashString('Test');
        assert.ok(Number.isInteger(hash));
        assert.ok(hash >= 1690000000);
    });
});

test('exportToAnki', async (t) => {
    // Setup global mocks
    let addedNotes = [];
    let addedDecks = [];
    let writtenFiles = [];

    class MockModel {
        constructor(config) {
            this.config = config;
        }
    }

    class MockDeck {
        constructor(id, name) {
            this.id = id;
            this.name = name;
        }
        addNote(note) {
            addedNotes.push(note);
        }
    }

    class MockNote {
        constructor(model, fields, tags, guid) {
            this.model = model;
            this.fields = fields;
            this.tags = tags;
            this.guid = guid;
        }
    }

    class MockPackage {
        constructor() {}
        addDeck(deck) {
            addedDecks.push(deck);
        }
        writeToFile(filename) {
            writtenFiles.push(filename);
        }
    }

    t.beforeEach(() => {
        addedNotes = [];
        addedDecks = [];
        writtenFiles = [];

        global.window = {
            Model: MockModel,
            Deck: MockDeck,
            Note: MockNote,
            Package: MockPackage,
            getSelectedLanguages: () => ({
                mainLang: 'pl',
                targets: [{ lang: 'en', translation: true, examples: true }]
            }),
            getTtsSpeed: () => 1.0
        };
    });

    t.afterEach(() => {
        delete global.window;
    });

    await t.test('happy path: exports basic words', () => {
        const wordsArray = [
            {
                _isGroup: true,
                _words: [
                    {
                        word_pl: 'pies',
                        root_pl: 'pies',
                        part_of_speech: 'noun',
                        translation_en: 'dog',
                        example_1_pl: 'To jest mój pies.',
                        example_1_en: 'This is my dog.'
                    }
                ],
                id: '123-abc'
            }
        ];

        exportToAnki(wordsArray, 'My Polish Deck');

        assert.strictEqual(addedDecks.length, 1);
        assert.strictEqual(addedDecks[0].name, 'My Polish Deck');

        assert.strictEqual(addedNotes.length, 1);
        assert.strictEqual(addedNotes[0].guid, '123-abc');
        assert.strictEqual(addedNotes[0].fields[0], 'pies'); // Front
        assert.ok(addedNotes[0].fields[1].includes('word: pies')); // Back includes word
        assert.ok(addedNotes[0].fields[1].includes('EN: dog')); // Back includes translation

        assert.strictEqual(writtenFiles.length, 1);
        assert.strictEqual(writtenFiles[0], 'my_polish_deck.apkg');
    });

    await t.test('skips empty or invalid word groups', () => {
        const wordsArray = [
            { _isGroup: false }, // Not a group
            { _isGroup: true, _words: [] }, // Empty words
            null, // Invalid
            {
                _isGroup: true,
                _words: [
                    {
                        word_pl: 'kot',
                        root_pl: 'kot',
                        translation_en: 'cat'
                    }
                ],
                id: '456-def'
            }
        ];

        // Should only process the last valid group
        exportToAnki(wordsArray.filter(Boolean), 'Test Deck');

        assert.strictEqual(addedNotes.length, 1);
        assert.strictEqual(addedNotes[0].fields[0], 'kot');
    });

    await t.test('handles missing root or part of speech gracefully', () => {
        const wordsArray = [
            {
                _isGroup: true,
                _words: [
                    {
                        word_pl: 'szybko',
                        // missing root_pl
                        // missing part_of_speech
                        translation_en: 'quickly'
                    }
                ],
                id: '789-ghi'
            }
        ];

        exportToAnki(wordsArray, 'Deck');

        assert.strictEqual(addedNotes.length, 1);
        const backHtml = addedNotes[0].fields[1];
        assert.ok(!backHtml.includes('Root:'));
        assert.ok(!backHtml.includes('part_of_speech:'));
        assert.ok(backHtml.includes('word: szybko'));
    });
});
