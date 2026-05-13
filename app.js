// Core State
let stagedWords = [];

// DOM Elements
const elements = {
    apiKeyInput: document.getElementById('api-key'),
    saveApiKeyBtn: document.getElementById('save-api-key'),
    deckNameInput: document.getElementById('deck-name'),
    exportJsonBtn: document.getElementById('export-json-btn'),
    importJsonInput: document.getElementById('import-json-file'),
    wordInput: document.getElementById('polish-word-input'),
    generateBtn: document.getElementById('generate-btn'),
    statusMessage: document.getElementById('status-message'),
    wordsContainer: document.getElementById('words-container'),
    emptyState: document.getElementById('empty-state'),
    wordCount: document.getElementById('word-count'),
    exportAnkiBtn: document.getElementById('export-anki-btn'),
    systemPrompt: document.getElementById('system-prompt'),
    modelSelect: document.getElementById('gemini-model-select'),

    // Edit Modal Elements
    editModal: document.getElementById('edit-modal'),
    editId: document.getElementById('edit-id'),
    editWord: document.getElementById('edit-word'),
    editRoot: document.getElementById('edit-root'),
    editTranslation: document.getElementById('edit-translation'),
    editEx1Pl: document.getElementById('edit-ex1-pl'),
    editEx1En: document.getElementById('edit-ex1-en'),
    editEx2Pl: document.getElementById('edit-ex2-pl'),
    editEx2En: document.getElementById('edit-ex2-en'),
    saveEditBtn: document.getElementById('save-edit-btn'),
    cancelEditBtn: document.getElementById('cancel-edit-btn')
};

// Initialize App
function init() {
    // Load API key from local storage
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
        elements.apiKeyInput.value = savedKey;
        fetchModels(savedKey);
    }

    // Event Listeners
    elements.saveApiKeyBtn.addEventListener('click', saveApiKey);
    elements.generateBtn.addEventListener('click', handleGenerate);
    elements.exportJsonBtn.addEventListener('click', exportJson);
    elements.importJsonInput.addEventListener('change', importJson);
    elements.cancelEditBtn.addEventListener('click', closeEditModal);
    elements.saveEditBtn.addEventListener('click', saveEditedWord);

    // Save model choice on change
    elements.modelSelect.addEventListener('change', (e) => {
        localStorage.setItem('gemini_model_pref', e.target.value);
    });

    // We bind export Anki later in anki-export.js, but check if we need to disable it
    updateUI();
}

// Save API Key
function saveApiKey() {
    const key = elements.apiKeyInput.value.trim();
    if (key) {
        localStorage.setItem('gemini_api_key', key);
        showStatus('API Key saved successfully!', 'success');
        fetchModels(key);
    } else {
        showStatus('Please enter an API key.', 'error');
    }
}

// Fetch Models dynamically
async function fetchModels(apiKey) {
    try {
        elements.modelSelect.innerHTML = '<option value="">Loading models...</option>';
        elements.modelSelect.disabled = true;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok) throw new Error('Failed to fetch models. Check API Key.');

        const data = await response.json();
        const models = data.models
            .filter(m => m.supportedGenerationMethods.includes('generateContent') && m.name.includes('flash'))
            .map(m => m.name.replace('models/', ''));

        elements.modelSelect.innerHTML = '';
        models.forEach(modelName => {
            const option = document.createElement('option');
            option.value = modelName;
            option.textContent = modelName;
            elements.modelSelect.appendChild(option);
        });

        elements.modelSelect.disabled = false;

        const savedModel = localStorage.getItem('gemini_model_pref');
        if (savedModel && models.includes(savedModel)) {
            elements.modelSelect.value = savedModel;
        } else if (models.includes('gemini-2.5-flash')) {
            elements.modelSelect.value = 'gemini-2.5-flash';
        }

    } catch (e) {
        elements.modelSelect.innerHTML = '<option value="">Error loading models</option>';
        showStatus(e.message, 'error');
    }
}

// Display status/error messages
function showStatus(message, type = 'info') {
    elements.statusMessage.textContent = message;
    elements.statusMessage.classList.remove('hidden', 'text-red-600', 'text-green-600', 'text-blue-600');

    if (type === 'error') elements.statusMessage.classList.add('text-red-600');
    else if (type === 'success') elements.statusMessage.classList.add('text-green-600');
    else elements.statusMessage.classList.add('text-blue-600');

    // Auto-hide after 5 seconds if not an error
    if (type !== 'error') {
        setTimeout(() => {
            elements.statusMessage.classList.add('hidden');
        }, 5000);
    }
}

// Generate unique ID (using timestamp + random string)
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Handle Generate Button Click
async function handleGenerate() {
    const word = elements.wordInput.value.trim();
    const apiKey = localStorage.getItem('gemini_api_key');

    if (!apiKey) {
        showStatus('Please save your Gemini API Key first.', 'error');
        return;
    }
    if (!word) {
        showStatus('Please enter a Polish word.', 'error');
        return;
    }

    // Set UI to loading state
    elements.generateBtn.disabled = true;
    elements.generateBtn.textContent = 'Generating...';
    showStatus('Calling Gemini API...', 'info');

    try {
        const customPrompt = elements.systemPrompt.value;
        const selectedModel = elements.modelSelect.value || 'gemini-1.5-flash';
        const data = await callGeminiAPI(word, apiKey, customPrompt, selectedModel);

        // Check for AI-generated error (e.g. unrecognizable word)
        if (data.error) {
            showStatus(`AI could not process "${word}": ${data.error}`, 'error');
            return;
        }

        // Add unique ID for tracking/Anki GUID
        data.id = generateUniqueId();

        // Add to staging area
        stagedWords.unshift(data); // Add to beginning of array

        // Clear input and update UI
        elements.wordInput.value = '';
        showStatus(`Successfully generated data for "${word}"`, 'success');
        updateUI();

    } catch (error) {
        console.error(error);
        showStatus(`Error: ${error.message}`, 'error');
    } finally {
        elements.generateBtn.disabled = false;
        elements.generateBtn.textContent = 'Generate Data';
    }
}

// Call Gemini API
async function callGeminiAPI(word, apiKey, customInstruction, model) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const jsonSchemaTemplate = `
{
  "word_pl": "string",
  "translation_en": "string",
  "translation_es": "string",
  "root_pl": "string",
  "part_of_speech": "string (e.g., Noun, Verb, Adjective)",
  "example_1_pl": "string",
  "example_1_en": "string",
  "example_2_pl": "string",
  "example_2_en": "string",
  "error": "string (only if invalid)"
}
`;

    const fullSystemInstruction = `${customInstruction}\n\n${jsonSchemaTemplate}`;

    const payload = {
        contents: [{
            parts: [{ text: word }]
        }],
        systemInstruction: {
            parts: [{ text: fullSystemInstruction }]
        },
        generationConfig: {
            temperature: 0.2 // Low temperature for more deterministic/dictionary-like results
        }
    };

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch from Gemini API');
    }

    const data = await response.json();
    let aiText = data.candidates[0].content.parts[0].text;

    // Clean up response (strip markdown backticks if present)
    aiText = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();

    try {
        return JSON.parse(aiText);
    } catch (e) {
        throw new Error('AI returned invalid JSON format. Try again.');
    }
}

// Update the UI (Staging area list and counts)
function updateUI() {
    elements.wordCount.textContent = `${stagedWords.length} words`;

    if (stagedWords.length === 0) {
        elements.emptyState.classList.remove('hidden');
        elements.wordsContainer.innerHTML = '';
        elements.wordsContainer.appendChild(elements.emptyState);
    } else {
        elements.emptyState.classList.add('hidden');
        elements.wordsContainer.innerHTML = '';

        // Helper to safely escape HTML to prevent XSS
        const escapeHTML = (str) => {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        stagedWords.forEach((wordObj, index) => {
            const card = document.createElement('div');
            card.className = 'bg-gray-700 p-4 rounded-lg border border-gray-600 relative group';

            const safeId = escapeHTML(wordObj.id);

            card.innerHTML = `                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3">
                    <div class="flex-1">
                        <div class="flex items-center space-x-3">
                            <h3 class="text-xl font-bold text-blue-400">${escapeHTML(wordObj.word_pl)}</h3>
                            <span class="px-2 py-0.5 rounded text-xs font-semibold bg-gray-600 text-gray-200">${escapeHTML(wordObj.part_of_speech)}</span>
                        </div>
                        <p class="text-sm text-gray-400 mt-1">Root: <span class="text-gray-300 font-medium">${escapeHTML(wordObj.root_pl)}</span></p>
                    </div>

                    <div class="flex space-x-2 mt-2 sm:mt-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="openEditModal('${safeId}')" class="text-blue-400 hover:text-blue-300 p-1 bg-gray-800 rounded">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        </button>
                        <button onclick="deleteWord('${safeId}')" class="text-red-400 hover:text-red-300 p-1 bg-gray-800 rounded">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </div>

                <div class="mb-3 bg-gray-800 p-3 rounded-md border border-gray-600">
                    <p class="text-md font-medium text-gray-200">EN: ${escapeHTML(wordObj.translation_en)}</p>
                    <p class="text-md font-medium text-gray-300">ES: ${escapeHTML(wordObj.translation_es)}</p>
                </div>

                <div class="text-sm space-y-3 text-gray-300 pl-1">
                    <div>
                        <p class="font-medium text-gray-200"><span class="font-bold text-gray-400 mr-1">1.</span>${escapeHTML(wordObj.example_1_pl)}</p>
                        <p class="text-gray-400 italic text-xs mt-0.5">EN: ${escapeHTML(wordObj.example_1_en)}</p>
                    </div>
                    <div>
                        <p class="font-medium text-gray-200"><span class="font-bold text-gray-400 mr-1">2.</span>${escapeHTML(wordObj.example_2_pl)}</p>
                        <p class="text-gray-400 italic text-xs mt-0.5">EN: ${escapeHTML(wordObj.example_2_en)}</p>
                    </div>
                </div>`;
            elements.wordsContainer.appendChild(card);
        });
    }
}

// Delete word from staging
window.deleteWord = function(id) {
    stagedWords = stagedWords.filter(w => w.id !== id);
    updateUI();
};

// Edit Modal Functions
window.openEditModal = function(id) {
    const wordObj = stagedWords.find(w => w.id === id);
    if (!wordObj) return;

    document.getElementById('edit-id').value = wordObj.id;
    document.getElementById('edit-word').value = wordObj.word_pl || '';
    document.getElementById('edit-root').value = wordObj.root_pl || '';
    document.getElementById('edit-pos').value = wordObj.part_of_speech || '';
    document.getElementById('edit-translation').value = wordObj.translation_en || '';
    document.getElementById('edit-translation-es').value = wordObj.translation_es || '';
    document.getElementById('edit-ex1-pl').value = wordObj.example_1_pl || '';
    document.getElementById('edit-ex1-en').value = wordObj.example_1_en || '';
    document.getElementById('edit-ex2-pl').value = wordObj.example_2_pl || '';
    document.getElementById('edit-ex2-en').value = wordObj.example_2_en || '';

    elements.editModal.classList.remove('hidden');
};

function closeEditModal() {
    elements.editModal.classList.add('hidden');
}

function saveEditedWord() {
    const id = document.getElementById('edit-id').value;
    const index = stagedWords.findIndex(w => w.id === id);

    if (index !== -1) {
        stagedWords[index] = {
            id: id,
            word_pl: document.getElementById('edit-word').value.trim(),
            root_pl: document.getElementById('edit-root').value.trim(),
            part_of_speech: document.getElementById('edit-pos').value.trim(),
            translation_en: document.getElementById('edit-translation').value.trim(),
            translation_es: document.getElementById('edit-translation-es').value.trim(),
            example_1_pl: document.getElementById('edit-ex1-pl').value.trim(),
            example_1_en: document.getElementById('edit-ex1-en').value.trim(),
            example_2_pl: document.getElementById('edit-ex2-pl').value.trim(),
            example_2_en: document.getElementById('edit-ex2-en').value.trim()
        };
        updateUI();
        closeEditModal();
    }
}

// Export Project State to JSON
function exportJson() {
    if (stagedWords.length === 0) {
        showStatus("Nothing to export yet.", "error");
        return;
    }

    const deckName = elements.deckNameInput.value.trim() || 'Polish_Deck';
    const projectData = {
        deckName: deckName,
        words: stagedWords
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projectData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${deckName.replace(/\s+/g, '_')}_project.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

// Import Project State from JSON
function importJson(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.words && Array.isArray(data.words)) {
                stagedWords = data.words;
                if (data.deckName) {
                    elements.deckNameInput.value = data.deckName;
                }
                updateUI();
                showStatus('Project loaded successfully!', 'success');
            } else {
                throw new Error("Invalid format");
            }
        } catch (error) {
            showStatus('Error loading JSON file. Make sure it is a valid project file.', 'error');
            console.error(error);
        }
        // Reset file input so the same file can be loaded again if needed
        event.target.value = '';
    };
    reader.readAsText(file);
}

// Expose state and init for other scripts
window.getStagedWords = () => stagedWords;
window.getDeckName = () => elements.deckNameInput.value.trim() || 'Polish Vocabulary';

// Start app
document.addEventListener('DOMContentLoaded', init);
