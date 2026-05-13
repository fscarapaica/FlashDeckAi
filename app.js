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
    }

    // Event Listeners
    elements.saveApiKeyBtn.addEventListener('click', saveApiKey);
    elements.generateBtn.addEventListener('click', handleGenerate);
    elements.exportJsonBtn.addEventListener('click', exportJson);
    elements.importJsonInput.addEventListener('change', importJson);
    elements.cancelEditBtn.addEventListener('click', closeEditModal);
    elements.saveEditBtn.addEventListener('click', saveEditedWord);

    // We bind export Anki later in anki-export.js, but check if we need to disable it
    updateUI();
}

// Save API Key
function saveApiKey() {
    const key = elements.apiKeyInput.value.trim();
    if (key) {
        localStorage.setItem('gemini_api_key', key);
        showStatus('API Key saved successfully!', 'success');
    } else {
        showStatus('Please enter an API key.', 'error');
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
        const data = await callGeminiAPI(word, apiKey, customPrompt);

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
async function callGeminiAPI(word, apiKey, customInstruction) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const jsonSchemaTemplate = `
{
  "word_pl": "string (the word provided)",
  "root_pl": "string (infinitive or nominative root)",
  "translation_en": "string",
  "example_1_pl": "string",
  "example_1_en": "string",
  "example_2_pl": "string",
  "example_2_en": "string"
}`;

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

        stagedWords.forEach((wordObj, index) => {
            const card = document.createElement('div');
            card.className = 'bg-gray-700 p-4 rounded-lg border border-gray-600 relative group';

            card.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h3 class="text-lg font-bold text-gray-100">${wordObj.word_pl}</h3>
                        <p class="text-sm text-gray-400">Root: ${wordObj.root_pl} | ${wordObj.translation_en}</p>
                    </div>
                    <div class="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="openEditModal('${wordObj.id}')" class="text-blue-400 hover:text-blue-300 p-1">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        </button>
                        <button onclick="deleteWord('${wordObj.id}')" class="text-red-400 hover:text-red-300 p-1">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </div>
                <div class="text-sm mt-3 space-y-1 text-gray-300">
                    <p><strong class="text-gray-200">1.</strong> ${wordObj.example_1_pl} <br><span class="text-gray-400 italic">${wordObj.example_1_en}</span></p>
                    <p><strong class="text-gray-200">2.</strong> ${wordObj.example_2_pl} <br><span class="text-gray-400 italic">${wordObj.example_2_en}</span></p>
                </div>
            `;
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

    elements.editId.value = wordObj.id;
    elements.editWord.value = wordObj.word_pl;
    elements.editRoot.value = wordObj.root_pl;
    elements.editTranslation.value = wordObj.translation_en;
    elements.editEx1Pl.value = wordObj.example_1_pl;
    elements.editEx1En.value = wordObj.example_1_en;
    elements.editEx2Pl.value = wordObj.example_2_pl;
    elements.editEx2En.value = wordObj.example_2_en;

    elements.editModal.classList.remove('hidden');
};

function closeEditModal() {
    elements.editModal.classList.add('hidden');
}

function saveEditedWord() {
    const id = elements.editId.value;
    const index = stagedWords.findIndex(w => w.id === id);

    if (index !== -1) {
        stagedWords[index] = {
            id: id,
            word_pl: elements.editWord.value.trim(),
            root_pl: elements.editRoot.value.trim(),
            translation_en: elements.editTranslation.value.trim(),
            example_1_pl: elements.editEx1Pl.value.trim(),
            example_1_en: elements.editEx1En.value.trim(),
            example_2_pl: elements.editEx2Pl.value.trim(),
            example_2_en: elements.editEx2En.value.trim()
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
