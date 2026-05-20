const { test, describe } = require('node:test');
const assert = require('node:assert');
const { hashString } = require('./anki-export.js');

describe('hashString', () => {
    test('should return exactly 1690000000 for an empty string', () => {
        assert.strictEqual(hashString(''), 1690000000);
    });

    test('should return a consistent hash for the same string', () => {
        const input = 'test deck name';
        const hash1 = hashString(input);
        const hash2 = hashString(input);
        assert.strictEqual(hash1, hash2);
    });

    test('should return different hashes for different strings', () => {
        const hash1 = hashString('deck 1');
        const hash2 = hashString('deck 2');
        assert.notStrictEqual(hash1, hash2);
    });

    test('should always return a value >= 1690000000', () => {
        const inputs = ['a', 'A', '123', 'Deck Name', 'Special!@#$', ' ', 'very long string'.repeat(100)];
        for (const input of inputs) {
            const hash = hashString(input);
            assert.ok(hash >= 1690000000, `Hash ${hash} for input "${input}" is less than 1690000000`);
            assert.ok(Number.isInteger(hash), `Hash ${hash} is not an integer`);
        }
    });

    test('should handle special characters and emojis consistently', () => {
        const emojiStr = '🇺🇸 English Vocab 📚';
        const hash1 = hashString(emojiStr);
        const hash2 = hashString(emojiStr);
        assert.strictEqual(hash1, hash2);

        const specialStr = 'ñ, á, é, í, ó, ú, ü, ¿, ¡';
        const hash3 = hashString(specialStr);
        const hash4 = hashString(specialStr);
        assert.strictEqual(hash3, hash4);
    });

    test('should handle very long strings without throwing errors', () => {
        const longStr = 'a'.repeat(10000);
        const hash = hashString(longStr);
        assert.ok(typeof hash === 'number');
        assert.ok(hash >= 1690000000);
    });
});
