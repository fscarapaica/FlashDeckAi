const { test, describe, mock } = require('node:test');
const assert = require('node:assert');

// We have to set up global fetch since app.js relies on it
global.fetch = mock.fn();

// Require our application logic after setting up globals
const { callGeminiAPI } = require('./app.js');

describe('callGeminiAPI', () => {
    test('should throw an error if AI returns invalid JSON format', async () => {
        // Arrange
        const mockResponse = {
            ok: true,
            json: async () => ({
                candidates: [
                    {
                        content: {
                            parts: [
                                { text: 'This is not valid JSON string...' }
                            ]
                        }
                    }
                ]
            })
        };
        global.fetch.mock.mockImplementationOnce(() => Promise.resolve(mockResponse));

        // Act & Assert
        await assert.rejects(
            async () => {
                await callGeminiAPI('testWord', 'fake-api-key', 'system instruction', 'model-1', 'English');
            },
            {
                name: 'Error',
                message: 'AI returned invalid JSON format. Try again.'
            }
        );
    });

    test('should successfully parse valid JSON from AI', async () => {
        // Arrange
        const validJsonObj = { word_en: "test", part_of_speech: "noun" };
        const mockResponse = {
            ok: true,
            json: async () => ({
                candidates: [
                    {
                        content: {
                            parts: [
                                { text: '```json\n' + JSON.stringify(validJsonObj) + '\n```' }
                            ]
                        }
                    }
                ]
            })
        };
        global.fetch.mock.mockImplementationOnce(() => Promise.resolve(mockResponse));

        // Act
        const result = await callGeminiAPI('testWord', 'fake-api-key', 'system instruction', 'model-1', 'English');

        // Assert
        assert.deepStrictEqual(result, validJsonObj);
    });
});
