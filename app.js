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
    batchProgressContainer: document.getElementById('batch-progress-container'),
    batchProgressText: document.getElementById('batch-progress-text'),
    batchProgressPercentage: document.getElementById('batch-progress-percentage'),
    batchProgressBar: document.getElementById('batch-progress-bar'),
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
    saveEditBtn: document.getElementById('save-edit-btn'),
    cancelEditBtn: document.getElementById('cancel-edit-btn'),
    mainLanguage: document.getElementById('main-language'),
    targetLanguagesContainer: document.getElementById('target-languages-container'),
    dynamicEditFields: document.getElementById('dynamic-edit-fields'),
    promptSettingsBtn: document.getElementById('prompt-settings-btn'),
    promptModal: document.getElementById('prompt-modal'),
    closePromptBtn: document.getElementById('close-prompt-btn')
};

// Initialize App
function init() {
    // Load API key from local storage
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
        elements.apiKeyInput.value = savedKey;
        fetchModels(savedKey);
    }

    // Load stagedWords from localStorage
    const savedWords = localStorage.getItem('anki_staged_words');
    if (savedWords) {
        try {
            stagedWords = JSON.parse(savedWords);
        } catch(e) {
            console.error("Could not parse saved words");
        }
    }

    const savedLangSettings = localStorage.getItem('anki_lang_settings');
    if (savedLangSettings) {
        try {
            const parsed = JSON.parse(savedLangSettings);
            if (parsed.mainLang && elements.mainLanguage) {
                elements.mainLanguage.value = parsed.mainLang;
            }
            if (parsed.targets && elements.targetLanguagesContainer) {
                const items = elements.targetLanguagesContainer.querySelectorAll('.target-lang-item');
                items.forEach(item => {
                    const transCb = item.querySelector('.lang-trans-cb');
                    const exCb = item.querySelector('.lang-ex-cb');
                    if (transCb || exCb) {
                        const lang = (transCb || exCb).value;
                        const target = parsed.targets.find(t => t.lang === lang);
                        if (target) {
                            if (transCb) transCb.checked = target.translation;
                            if (exCb) exCb.checked = target.examples;
                        } else {
                            if (transCb) transCb.checked = false;
                            if (exCb) exCb.checked = false;
                        }
                    }
                });
            }
        } catch (e) {
            console.error("Failed to parse saved lang settings", e);
        }
    } else {
        setupLanguageCheckboxes();
    }


    // Event Listeners
    elements.saveApiKeyBtn.addEventListener('click', saveApiKey);
    elements.generateBtn.addEventListener('click', handleGenerate);
    elements.exportJsonBtn.addEventListener('click', exportJson);
    elements.importJsonInput.addEventListener('change', importJson);
    elements.cancelEditBtn.addEventListener('click', closeEditModal);
    elements.saveEditBtn.addEventListener('click', saveEditedWord);

    if (elements.promptSettingsBtn) {
        elements.promptSettingsBtn.addEventListener('click', () => {
            elements.promptModal.classList.remove('hidden');
        });
        elements.closePromptBtn.addEventListener('click', () => {
            elements.promptModal.classList.add('hidden');
        });
    }

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
    const inputText = elements.wordInput.value.trim();
    const apiKey = localStorage.getItem('gemini_api_key');

    if (!apiKey) {
        showStatus('Please save your Gemini API Key first.', 'error');
        return;
    }
    if (!inputText) {
        showStatus('Please enter at least one word.', 'error');
        return;
    }

    // Parse input string by comma, newline, or multiple spaces
    const wordsRaw = inputText.split(/[\n,\s]+/);
    const words = wordsRaw.map(w => w.trim()).filter(w => w.length > 0);

    if (words.length === 0) {
        showStatus('Please enter at least one valid word.', 'error');
        return;
    }

    // Set UI to loading state
    elements.generateBtn.disabled = true;
    elements.generateBtn.textContent = 'Generating...';

    // Setup Progress Bar
    let processedCount = 0;
    let successCount = 0;
    let failedWords = [];

    if (words.length > 1) {
        elements.batchProgressContainer.classList.remove('hidden');
        elements.batchProgressText.textContent = `Processing 0 of ${words.length}...`;
        elements.batchProgressBar.style.width = '0%';
        elements.batchProgressPercentage.textContent = '0%';
        showStatus(`Starting batch generation for ${words.length} words...`, 'info');
    } else {
        showStatus('Calling Gemini API...', 'info');
    }

    try {
        const { mainLangName } = getSelectedLanguages();

        let customPromptText = '';
        if (elements.systemPrompt) {
            customPromptText = elements.systemPrompt.value;
        }

        const customPrompt = customPromptText.replace(/\[MAIN_LANGUAGE\]/g, mainLangName);
        const selectedModel = elements.modelSelect.value || 'gemini-1.5-flash';

        // Process concurrently
        const promises = words.map(async (word) => {
            try {
                const data = await callGeminiAPI(word, apiKey, customPrompt, selectedModel, mainLangName);
                processedCount++;

                // Update Progress UI
                if (words.length > 1) {
                    const percent = Math.round((processedCount / words.length) * 100);
                    elements.batchProgressText.textContent = `Processing ${processedCount} of ${words.length}...`;
                    elements.batchProgressBar.style.width = `${percent}%`;
                    elements.batchProgressPercentage.textContent = `${percent}%`;
                }

                if (data.error) {
                    failedWords.push(word);
                    return null;
                }

                data.id = generateUniqueId();
                return data;
            } catch (err) {
                processedCount++;
                failedWords.push(word);
                // Update Progress UI on error too
                if (words.length > 1) {
                    const percent = Math.round((processedCount / words.length) * 100);
                    elements.batchProgressText.textContent = `Processing ${processedCount} of ${words.length}...`;
                    elements.batchProgressBar.style.width = `${percent}%`;
                    elements.batchProgressPercentage.textContent = `${percent}%`;
                }
                return null;
            }
        });

        const results = await Promise.all(promises);

        // Handle results (incorporating root grouping logic to come in the next step, for now just push)
        results.forEach(data => {
            if (data) {
                successCount++;
                processAndMergeWord(data); // We will define this next
            }
        });

        // Clear input and update UI
        if (failedWords.length > 0) {
            elements.wordInput.value = failedWords.join(', ');
            if (successCount > 0) {
                showStatus(`Successfully generated ${successCount} words. Failed on ${failedWords.length} words.`, 'error');
            } else {
                showStatus(`Failed to generate data for all words.`, 'error');
            }
        } else {
            elements.wordInput.value = '';
            if (words.length > 1) {
                showStatus(`Successfully generated data for all ${successCount} words!`, 'success');
            } else {
                showStatus(`Successfully generated data for "${words[0]}"!`, 'success');
            }
        }

        updateUI();
        saveState();

    } catch (error) {
        console.error(error);
        showStatus(`Error: ${error.message}`, 'error');
    } finally {
        elements.generateBtn.disabled = false;
        elements.generateBtn.textContent = 'Generate Data';

        setTimeout(() => {
            if (elements.batchProgressContainer) {
                elements.batchProgressContainer.classList.add('hidden');
            }
        }, 2000); // Hide progress after a brief delay
    }
}

function processAndMergeWord(data) {
    const mainLang = elements.mainLanguage ? elements.mainLanguage.value : 'pl';
    const rootKey = `root_${mainLang}`;
    const wordKey = `word_${mainLang}`;

    // Find the root form of the new word
    const newRoot = data[rootKey];

    if (!newRoot) {
        // Fallback: if no root is found in the response, just add it normally but initialize as a group
        data._isGroup = true;
        data._words = [data];
        stagedWords.unshift(data);
        return;
    }

    // Check if a group with this root already exists in stagedWords
    const existingGroupIndex = stagedWords.findIndex(item => item[rootKey] === newRoot && item._isGroup);

    if (existingGroupIndex !== -1) {
        // Group exists, check if this specific word is already in the group
        const existingGroup = stagedWords[existingGroupIndex];
        const wordAlreadyExists = existingGroup._words.some(w => w[wordKey] === data[wordKey]);

        if (!wordAlreadyExists) {
            existingGroup._words.push(data);

            // Move this group to the top of the list since it was recently updated
            stagedWords.splice(existingGroupIndex, 1);
            stagedWords.unshift(existingGroup);
        }
    } else {
        // No existing group for this root.
        // We will restructure the data object to represent a "Group"
        // We copy the base data to represent the group's "primary" entry, and add a _words array
        const newGroup = { ...data, _isGroup: true, _words: [data] };
        stagedWords.unshift(newGroup);
    }
}

// Call Gemini API
async function callGeminiAPI(word, apiKey, customInstruction, model, mainLangName) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const schemaObj = generateDynamicSchema();
    const jsonSchemaTemplate = JSON.stringify(schemaObj, null, 2);

    const fullSystemInstruction = `${customInstruction}\n\n${jsonSchemaTemplate}`;

    const userPrompt = `Target word to analyze in ${mainLangName || 'the specified main language'}: "${word}"`;

    const payload = {
        contents: [{
            parts: [{ text: userPrompt }]
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
    // Count total individual words, not just groups
    // Handle legacy non-grouped words in migration
    stagedWords.forEach(w => {
        if (!w._isGroup) {
            w._isGroup = true;
            w._words = [{...w}];
        }
    });

    const totalWords = stagedWords.reduce((acc, curr) => acc + (curr._isGroup ? curr._words.length : 1), 0);
    elements.wordCount.textContent = `${totalWords} words`;

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

        stagedWords.forEach((groupObj) => {
            if (!groupObj._isGroup) return; // Fallback safety

            const card = document.createElement('div');
            card.className = 'bg-[#09090B] p-4 rounded-xl border border-[#27272A] relative group mb-4';

            const safeId = escapeHTML(groupObj.id);
            const mainRootKey = Object.keys(groupObj).find(k => k.startsWith('root_')) || 'root_pl';
            const rootWord = groupObj[mainRootKey];

            // Generate list of all words in this group
            const wordKey = Object.keys(groupObj).find(k => k.startsWith('word_')) || 'word_pl';
            const allWords = groupObj._words.map(w => w[wordKey]).join(', ');

            card.innerHTML = `
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 pb-3 border-b border-[#27272A]">
                    <div class="flex-1">
                        <div class="flex items-center space-x-3 mb-1">
                            <span class="px-2 py-0.5 rounded text-xs font-semibold bg-[#F97316]/20 text-[#F97316] uppercase tracking-wider">Root</span>
                            <h3 class="text-xl font-bold text-zinc-100">${escapeHTML(rootWord)}</h3>
                        </div>
                        <p class="text-sm text-zinc-400 mt-1">Associated Words: <span class="text-zinc-200 font-medium">${escapeHTML(allWords)}</span></p>
                    </div>

                    <div class="flex space-x-2 mt-2 sm:mt-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="openEditModal('${safeId}')" class="text-zinc-400 hover:text-white p-2 bg-[#18181B] rounded-lg transition-colors border border-[#27272A]">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        </button>
                        <button onclick="deleteWord('${safeId}')" class="text-red-400 hover:text-red-300 p-2 bg-[#18181B] rounded-lg transition-colors border border-[#27272A]">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </div>

                <div class="space-y-4">
                    ${groupObj._words.map((w, idx) => {
                        return `
                        <div class="bg-[#18181B] p-3 rounded-lg border border-[#27272A]">
                            <div class="flex items-center space-x-3 mb-2">
                                <span class="font-bold text-[#F97316]">${escapeHTML(w[wordKey])}</span>
                                <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#27272A] text-zinc-300 uppercase">${escapeHTML(w.part_of_speech || '')}</span>
                            </div>

                            <div class="space-y-1">
                                ${Object.keys(w).filter(k => k.startsWith('translation_')).map(k => {
                                    const lang = k.split('_')[1].toUpperCase();
                                    return `<p class="text-sm text-zinc-200"><span class="font-medium text-zinc-500 mr-2">${lang}</span> ${escapeHTML(w[k])}</p>`;
                                }).join('')}
                            </div>

                            <div class="mt-2 space-y-1">
                                ${Object.keys(w).filter(k => k.startsWith('example_')).map(k => {
                                    const parts = k.split('_');
                                    const lang = parts[parts.length - 1].toUpperCase();
                                    return `<p class="text-xs text-zinc-400 italic border-l-2 border-[#27272A] pl-2 py-0.5"><span class="font-medium text-zinc-500 mr-1">${lang}</span> ${escapeHTML(w[k])}</p>`;
                                }).join('')}
                            </div>
                        </div>
                        `
                    }).join('')}
                </div>
            `;
            elements.wordsContainer.appendChild(card);
        });
    }

    elements.exportAnkiBtn.disabled = stagedWords.length === 0;
}

// Delete word from staging
window.deleteWord = function(id) {
    stagedWords = stagedWords.filter(w => w.id !== id);
    updateUI();
    saveState();
};

// Edit Modal Functions
window.openEditModal = function(id) {
    const groupObj = stagedWords.find(w => w.id === id);
    if (!groupObj) return;

    document.getElementById('edit-id').value = groupObj.id;

    // Clear and build dynamic fields
    elements.dynamicEditFields.innerHTML = '';

    const mainRootKey = Object.keys(groupObj).find(k => k.startsWith('root_')) || 'root_pl';
    const mainWordKey = Object.keys(groupObj).find(k => k.startsWith('word_')) || 'word_pl';

    // Create Root Editor Field
    const rootDiv = document.createElement('div');
    rootDiv.className = 'mb-6 pb-4 border-b border-[#27272A]';
    rootDiv.innerHTML = `
        <label class="block text-sm font-bold text-[#F97316] mb-1">Shared Root Form</label>
        <input type="text" class="w-full px-3 py-2 border border-[#27272A] bg-[#09090B] text-zinc-100 rounded-xl focus:outline-none focus:border-[#F97316] edit-dynamic-input" data-is-root="true" data-key="${mainRootKey}" value="${(groupObj[mainRootKey] || '').replace(/"/g, '&quot;')}">
    `;
    elements.dynamicEditFields.appendChild(rootDiv);

    // Loop through each word in the group and generate fields
    groupObj._words.forEach((wordObj, index) => {
        const wordCard = document.createElement('div');
        wordCard.className = 'bg-[#18181B] p-4 rounded-xl border border-[#27272A] mb-4';
        wordCard.innerHTML = `<h4 class="text-md font-bold text-zinc-100 mb-3 pb-2 border-b border-[#27272A]">Word ${index + 1}</h4>`;

        const fields = [];
        fields.push({ key: mainWordKey, label: 'Target Word' });
        fields.push({ key: 'part_of_speech', label: 'Part of Speech' });

        Object.keys(wordObj).forEach(key => {
            if (key.startsWith('translation_')) {
                const lang = key.split('_')[1].toUpperCase();
                fields.push({ key: key, label: `Translation (${lang})` });
            }
            if (key.startsWith('example_')) {
                const parts = key.split('_');
                const lang = parts[parts.length - 1].toUpperCase();
                fields.push({ key: key, label: `Example (${lang})` });
            }
        });

        fields.forEach(field => {
            const val = wordObj[field.key] || '';
            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'mb-3';

            fieldDiv.innerHTML = `
                <label class="block text-xs font-medium text-zinc-400 mb-1">${field.label}</label>
                ${field.key.startsWith('example_') ?
                    `<textarea rows="2" class="w-full px-3 py-2 border border-[#27272A] bg-[#09090B] text-zinc-100 rounded-xl focus:outline-none focus:border-[#F97316] text-sm edit-dynamic-input" data-word-idx="${index}" data-key="${field.key}">${val.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>`
                    :
                    `<input type="text" class="w-full px-3 py-2 border border-[#27272A] bg-[#09090B] text-zinc-100 rounded-xl focus:outline-none focus:border-[#F97316] edit-dynamic-input" data-word-idx="${index}" data-key="${field.key}" value="${val.replace(/"/g, '&quot;')}">`
                }
            `;
            wordCard.appendChild(fieldDiv);
        });

        elements.dynamicEditFields.appendChild(wordCard);
    });

    elements.editModal.classList.remove('hidden');
};

function closeEditModal() {
    elements.editModal.classList.add('hidden');
}

function saveEditedWord() {
    const id = document.getElementById('edit-id').value;
    const index = stagedWords.findIndex(w => w.id === id);

    if (index !== -1) {
        const groupObj = stagedWords[index];
        const inputs = elements.dynamicEditFields.querySelectorAll('.edit-dynamic-input');

        let newRootVal = '';

        inputs.forEach(input => {
            if (input.getAttribute('data-is-root') === 'true') {
                newRootVal = input.value.trim();
                groupObj[input.getAttribute('data-key')] = newRootVal;
            } else {
                const wIdx = parseInt(input.getAttribute('data-word-idx'), 10);
                const key = input.getAttribute('data-key');
                groupObj._words[wIdx][key] = input.value.trim();

                // Keep the root in sync for each individual word object too
                const mainRootKey = Object.keys(groupObj).find(k => k.startsWith('root_')) || 'root_pl';
                groupObj._words[wIdx][mainRootKey] = newRootVal;
            }
        });

        updateUI();
        saveState();
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
                saveState();
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
window.getSelectedLanguages = getSelectedLanguages;
window.getDeckName = () => elements.deckNameInput.value.trim() || 'Polish Vocabulary';

// Start app
document.addEventListener('DOMContentLoaded', init);


function setupLanguageCheckboxes() {
    if (!elements.targetLanguagesContainer) return;

    elements.targetLanguagesContainer.addEventListener('change', (e) => {
        if (e.target.classList.contains('lang-enable-cb')) {
            const isChecked = e.target.checked;
            const item = e.target.closest('.target-lang-item');
            const optionsDiv = item.querySelector('.lang-options-div');

            if (optionsDiv) {
                if (isChecked) {
                    optionsDiv.classList.remove('opacity-50', 'pointer-events-none');
                    // Automatically check translation if enabled
                    const transCb = optionsDiv.querySelector('.lang-trans-cb');
                    if (transCb) transCb.checked = true;
                } else {
                    optionsDiv.classList.add('opacity-50', 'pointer-events-none');
                }
            }
        }
    });
}

function getSelectedLanguages() {
    const mainLang = elements.mainLanguage ? elements.mainLanguage.value : 'pl';
    const mainLangName = elements.mainLanguage ? elements.mainLanguage.options[elements.mainLanguage.selectedIndex].text : 'Polish';
    const targets = [];

    if (elements.targetLanguagesContainer) {
        const items = elements.targetLanguagesContainer.querySelectorAll('.target-lang-item');
        items.forEach(item => {
            const transCb = item.querySelector('.lang-trans-cb');
            const exCb = item.querySelector('.lang-ex-cb');

            const isTransChecked = transCb ? transCb.checked : false;
            const isExChecked = exCb ? exCb.checked : false;

            if (isTransChecked || isExChecked) {
                const lang = (transCb || exCb).value;
                targets.push({
                    lang: lang,
                    translation: isTransChecked,
                    examples: isExChecked
                });
            }
        });
    } else {
        // Fallback for previous defaults
        targets.push({ lang: 'en', translation: true, examples: true });
        targets.push({ lang: 'es', translation: true, examples: false });
    }

    return { mainLang, mainLangName, targets };
}

function generateDynamicSchema() {
    const { mainLang, mainLangName, targets } = getSelectedLanguages();

    const schema = {
        [`word_${mainLang}`]: "string",
        [`root_${mainLang}`]: "string",
        "part_of_speech": "string (e.g., Noun, Verb, Adjective)"
    };

    targets.forEach(t => {
        if (t.translation) {
            schema[`translation_${t.lang}`] = "string";
        }
        if (t.examples) {
            schema[`example_1_${mainLang}`] = "string";
            schema[`example_1_${t.lang}`] = "string";
            schema[`example_2_${mainLang}`] = "string";
            schema[`example_2_${t.lang}`] = "string";
        }
    });

    schema["error"] = "string (only if invalid)";

    return schema;
}

function saveState() {
    localStorage.setItem('anki_staged_words', JSON.stringify(stagedWords));
    const langSettings = getSelectedLanguages();
    localStorage.setItem('anki_lang_settings', JSON.stringify(langSettings));
}
