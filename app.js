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
        const { mainLangName } = getSelectedLanguages();

        let customPromptText = '';
        if (elements.systemPrompt) {
            customPromptText = elements.systemPrompt.value;
        }

        const customPrompt = customPromptText.replace(/\[MAIN_LANGUAGE\]/g, mainLangName);
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
        saveState();

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

    const schemaObj = generateDynamicSchema();
    const jsonSchemaTemplate = JSON.stringify(schemaObj, null, 2);

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
            card.className = 'bg-[#09090B] p-4 rounded-lg border border-gray-600 relative group';

            const safeId = escapeHTML(wordObj.id);

            card.innerHTML = `                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3">
                    <div class="flex-1">
                        <div class="flex items-center space-x-3">
                            <h3 class="text-xl font-bold text-blue-400">${escapeHTML(wordObj[Object.keys(wordObj).find(k => k.startsWith('word_'))])}</h3>
                            <span class="px-2 py-0.5 rounded text-xs font-semibold bg-[#27272A] text-zinc-100">${escapeHTML(wordObj.part_of_speech)}</span>
                        </div>
                        <p class="text-sm text-zinc-400 mt-1">Root: <span class="text-gray-300 font-medium">${escapeHTML(wordObj[Object.keys(wordObj).find(k => k.startsWith('root_'))] || '')}</span></p>
                    </div>

                    <div class="flex space-x-2 mt-2 sm:mt-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="openEditModal('${safeId}')" class="text-blue-400 hover:text-blue-300 p-1 bg-[#18181B] rounded">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        </button>
                        <button onclick="deleteWord('${safeId}')" class="text-red-400 hover:text-red-300 p-1 bg-[#18181B] rounded">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </div>

                <div class="mb-3 bg-[#18181B] p-3 rounded-md border border-gray-600">
                    ${Object.keys(wordObj).filter(k => k.startsWith('translation_')).map(k => {
                        const lang = k.split('_')[1].toUpperCase();
                        return `<p class="text-md font-medium text-zinc-100">${lang}: ${escapeHTML(wordObj[k])}</p>`;
                    }).join('')}
                </div>

                <div class="text-sm space-y-3 text-gray-300 pl-1">
                    ${(() => {
                        const mainLangKey = Object.keys(wordObj).find(k => k.startsWith('word_'));
                        const mainLang = mainLangKey ? mainLangKey.split('_')[1] : 'pl';
                        let exHtml = '';
                        [1, 2].forEach(num => {
                            if (wordObj[`example_${num}_${mainLang}`]) {
                                exHtml += `<div>
                                    <p class="font-medium text-zinc-100"><span class="font-bold text-zinc-400 mr-1">${num}.</span>${escapeHTML(wordObj[`example_${num}_${mainLang}`])}</p>`;

                                // Find target language examples
                                Object.keys(wordObj).forEach(k => {
                                    if (k.startsWith(`example_${num}_`) && !k.endsWith(`_${mainLang}`)) {
                                        const lang = k.split('_')[2].toUpperCase();
                                        exHtml += `<p class="text-zinc-400 italic text-xs mt-0.5">${lang}: ${escapeHTML(wordObj[k])}</p>`;
                                    }
                                });
                                exHtml += `</div>`;
                            }
                        });
                        return exHtml;
                    })()}
                </div>`;
            elements.wordsContainer.appendChild(card);
        });
    }
}

// Delete word from staging
window.deleteWord = function(id) {
    stagedWords = stagedWords.filter(w => w.id !== id);
    updateUI();
    saveState();
};

// Edit Modal Functions
window.openEditModal = function(id) {
    const wordObj = stagedWords.find(w => w.id === id);
    if (!wordObj) return;

    document.getElementById('edit-id').value = wordObj.id;

    // Clear and build dynamic fields
    elements.dynamicEditFields.innerHTML = '';

    // Always show word, root, pos
    const mainWordKey = Object.keys(wordObj).find(k => k.startsWith('word_')) || 'word_pl';
    const mainRootKey = Object.keys(wordObj).find(k => k.startsWith('root_')) || 'root_pl';

    const baseFields = [
        { key: mainWordKey, label: 'Target Word' },
        { key: mainRootKey, label: 'Root / Base Form' },
        { key: 'part_of_speech', label: 'Part of Speech' }
    ];

    // Add translations
    Object.keys(wordObj).filter(k => k.startsWith('translation_')).forEach(k => {
        baseFields.push({ key: k, label: `Translation (${k.split('_')[1].toUpperCase()})` });
    });

    // Inject base fields
    baseFields.forEach(f => {
        elements.dynamicEditFields.innerHTML += `
            <div>
                <label class="block text-sm font-medium text-gray-300">${f.label}</label>
                <input type="text" id="edit-${f.key}" data-key="${f.key}" value="${(wordObj[f.key] || '').replace(/"/g, '&quot;')}" class="dynamic-edit-input mt-1 w-full px-3 py-2 border border-gray-600 bg-[#09090B] text-gray-100 rounded-md focus:outline-none focus:border-blue-500">
            </div>
        `;
    });

    // Add examples
    elements.dynamicEditFields.innerHTML += `<div class="col-span-2 space-y-4 mt-2">`;
    [1, 2].forEach(num => {
        const exampleKeys = Object.keys(wordObj).filter(k => k.startsWith(`example_${num}_`));
        if (exampleKeys.length > 0) {
            let exHtml = `<div class="p-3 bg-gray-900 rounded border border-[#27272A] space-y-2">
                <label class="block text-sm font-bold text-gray-300 border-b border-[#27272A] pb-1">Example ${num}</label>`;
            exampleKeys.forEach(k => {
                const lang = k.split('_')[2].toUpperCase();
                exHtml += `
                    <div class="flex items-center space-x-2">
                        <span class="text-xs font-bold text-gray-500 w-8">${lang}</span>
                        <input type="text" id="edit-${k}" data-key="${k}" value="${(wordObj[k] || '').replace(/"/g, '&quot;')}" class="dynamic-edit-input flex-1 px-3 py-1.5 border border-gray-600 bg-[#09090B] text-gray-100 rounded-md focus:outline-none focus:border-blue-500 text-sm">
                    </div>`;
            });
            exHtml += `</div>`;
            elements.dynamicEditFields.innerHTML += exHtml;
        }
    });
    elements.dynamicEditFields.innerHTML += `</div>`;

    elements.editModal.classList.remove('hidden');
};

function closeEditModal() {
    elements.editModal.classList.add('hidden');
}

function saveEditedWord() {
    const id = document.getElementById('edit-id').value;
    const index = stagedWords.findIndex(w => w.id === id);

    if (index !== -1) {
        const inputs = elements.dynamicEditFields.querySelectorAll('.dynamic-edit-input');
        const updatedWord = { id: id };

        inputs.forEach(input => {
            updatedWord[input.getAttribute('data-key')] = input.value.trim();
        });

        stagedWords[index] = updatedWord;
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
