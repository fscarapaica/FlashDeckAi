// Core State
let stagedWords = [];

// DOM Elements
const elements = typeof document !== 'undefined' ? {
    apiKeyInput: document.getElementById('api-key'),
    saveApiKeyBtn: document.getElementById('save-api-key'),
    deckNameInput: document.getElementById('deck-name'),
    exportJsonBtn: document.getElementById('export-json-btn'),
    importJsonInput: document.getElementById('import-json-file'),
    searchInput: document.getElementById('search-cards-input'),
    toggleCollapseBtn: document.getElementById('toggle-collapse-all-btn'),
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
    saveEditBtn: document.getElementById('save-edit-btn'),
    cancelEditBtn: document.getElementById('cancel-edit-btn'),
    mainLanguage: document.getElementById('main-language'),
    targetLanguagesContainer: document.getElementById('target-languages-container'),
    dynamicEditFields: document.getElementById('dynamic-edit-fields'),
} : {};

// Helper to migrate legacy non-grouped words
function migrateLegacyWords(wordsArray) {
    if (!Array.isArray(wordsArray)) return wordsArray;
    wordsArray.forEach(w => {
        if (!w._isGroup) {
            w._isGroup = true;
            w._words = [{...w}];
        }
    });
    return wordsArray;
}

// Initialize App
function init() {

// Import words from file
const importWordsInput = document.getElementById('import-words-file');
if (importWordsInput) {
    importWordsInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            // Basic text splitting, works for .txt, .csv, .md
            // For .pdf and .doc this is naive and would just extract text if it's plaintext
            const currentVal = elements.wordInput.value.trim();
            elements.wordInput.value = currentVal ? currentVal + '\n' + text : text;
            showStatus('File loaded successfully!', 'success');
        };
        reader.onerror = () => {
            showStatus('Error reading file', 'error');
        };
        reader.readAsText(file);

        // Reset file input
        e.target.value = '';
    });
}

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
            let parsedWords = JSON.parse(savedWords);
            stagedWords = migrateLegacyWords(parsedWords);
            updateUI(); // Make sure to render loaded words
        } catch(e) {
            console.error("Could not parse saved words");
        }
    }

    // Load deck name from localStorage
    const savedDeckName = localStorage.getItem('anki_deck_name');
    if (savedDeckName && elements.deckNameInput) {
        elements.deckNameInput.value = savedDeckName;
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


    // --- State for UI toggles ---
window.isAllCollapsed = false;
window.searchQuery = '';

    // --- TTS Speed Slider ---
    const ttsSpeedSlider = document.getElementById('tts-speed-slider');
    const ttsSpeedDisplay = document.getElementById('tts-speed-display');

    loadTtsSpeed();

    function loadTtsSpeed() {
        const speed = localStorage.getItem('ttsSpeed') || '1.0';
        ttsSpeedSlider.value = speed;
        ttsSpeedDisplay.textContent = `${speed}x`;
    };

    ttsSpeedSlider.addEventListener('input', (e) => {
        const speed = e.target.value;
        ttsSpeedDisplay.textContent = parseFloat(speed).toFixed(1) + 'x';
        localStorage.setItem('ttsSpeed', speed);
    });

    // Make it available to anki-export.js
    window.getTtsSpeed = () => parseFloat(ttsSpeedSlider.value);

    // Event Listeners
    elements.searchInput.addEventListener('input', (e) => {
        window.searchQuery = e.target.value.toLowerCase();
        updateUI();
    });

    elements.toggleCollapseBtn.addEventListener('click', () => {
        window.isAllCollapsed = !window.isAllCollapsed;
        elements.toggleCollapseBtn.textContent = window.isAllCollapsed ? 'Expand All' : 'Collapse All';
        updateUI();
    });

    elements.saveApiKeyBtn.addEventListener('click', saveApiKey);
    elements.generateBtn.addEventListener('click', handleGenerate);
    elements.exportJsonBtn.addEventListener('click', exportJson);
    elements.importJsonInput.addEventListener('change', importJson);
    elements.cancelEditBtn.addEventListener('click', closeEditModal);
    elements.saveEditBtn.addEventListener('click', saveEditedWord);

    // Save deck name on change
    if (elements.deckNameInput) {
        elements.deckNameInput.addEventListener('input', (e) => {
            localStorage.setItem('anki_deck_name', e.target.value.trim());
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

        // Process and group results by root
        results.forEach(data => {
            if (data) {
                successCount++;
                processAndMergeWord(data);
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

        // Cache keys from the first valid group to avoid redundant Object.keys() calls inside the loop
        let cachedRootKey = null;
        let cachedWordKey = null;

        const firstValidGroup = stagedWords.find(g => g._isGroup);
        if (firstValidGroup) {
            cachedRootKey = Object.keys(firstValidGroup).find(k => k.startsWith('root_')) || 'root_pl';
            cachedWordKey = Object.keys(firstValidGroup).find(k => k.startsWith('word_')) || 'word_pl';
        }

        stagedWords.forEach((groupObj) => {
            if (!groupObj._isGroup) return; // Fallback safety

            const safeId = escapeHTML(groupObj.id);

            // Fast path: use cached keys if they exist on this object
            const mainRootKey = (cachedRootKey && groupObj[cachedRootKey] !== undefined)
                ? cachedRootKey
                : (Object.keys(groupObj).find(k => k.startsWith('root_')) || 'root_pl');
            const rootWord = groupObj[mainRootKey] || '';

            // Generate list of all words in this group
            const wordKey = (cachedWordKey && groupObj[cachedWordKey] !== undefined)
                ? cachedWordKey
                : (Object.keys(groupObj).find(k => k.startsWith('word_')) || 'word_pl');
            const allWords = groupObj._words.map(w => w[wordKey]).join(', ');

            // Filtering based on search query
            if (window.searchQuery) {
                const matchesRoot = rootWord.toLowerCase().includes(window.searchQuery);
                const matchesWords = groupObj._words.some(w =>
                    (w[wordKey] || '').toLowerCase().includes(window.searchQuery)
                );

                if (!matchesRoot && !matchesWords) {
                    return; // Skip rendering this card
                }
            }

            const card = document.createElement('div');
            card.className = 'bg-[#09090B] p-4 rounded-xl border border-[#27272A] relative group mb-4';

            // Use closure state to track if this specific card is collapsed. Default to global state.
            let isCollapsed = window.isAllCollapsed;

            const renderCard = () => {
                const displayStyle = isCollapsed ? 'none' : 'block';
                card.innerHTML = `
                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center cursor-pointer select-none card-header" ${!isCollapsed ? 'class="mb-4 pb-3 border-b border-[#27272A]"' : ''}>
                        <div class="flex-1 pointer-events-none">
                            <div class="flex items-center space-x-3 mb-1">
                                <span class="px-2 py-0.5 rounded text-xs font-semibold bg-[#F97316]/20 text-[#F97316] uppercase tracking-wider">Root</span>
                                <h3 class="text-xl font-bold text-zinc-100">${escapeHTML(rootWord)}</h3>
                            </div>
                            <p class="text-sm text-zinc-400 mt-1">Associated Words: <span class="text-zinc-200 font-medium">${escapeHTML(allWords)}</span></p>
                        </div>
                    </div>

                    <div class="card-body" style="display: ${displayStyle};">
                        <div class="flex justify-end space-x-2 mb-4 pb-3 border-b border-[#27272A]">
                            <button data-action="edit" data-id="${safeId}" class="text-zinc-400 hover:text-white p-2 bg-[#18181B] rounded-lg transition-colors border border-[#27272A] edit-btn">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            </button>
                            <button data-action="delete" data-id="${safeId}" class="text-red-400 hover:text-red-300 p-2 bg-[#18181B] rounded-lg transition-colors border border-[#27272A] delete-btn">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
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
                    </div>
                `;

                card.querySelector('.card-header').addEventListener('click', () => {
                    isCollapsed = !isCollapsed;
                    renderCard();
                });

                const editBtn = card.querySelector('.edit-btn');
                if (editBtn) {
                    editBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openEditModal(groupObj.id);
                    });
                }

                const deleteBtn = card.querySelector('.delete-btn');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        deleteWord(groupObj.id);
                    });
                }
            };

            renderCard();
            elements.wordsContainer.appendChild(card);
        });
    }

    elements.exportAnkiBtn.disabled = stagedWords.length === 0;
}

// Ensure window exists for tests
if (typeof window === 'undefined') {
    global.window = {};
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
                stagedWords = migrateLegacyWords(data.words);
                if (data.deckName) {
                    elements.deckNameInput.value = data.deckName;
                    localStorage.setItem('anki_deck_name', data.deckName);
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
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => { renderTargetLanguages(); init(); initModals(); });
}

function initModals() {
    const deckConfigModal = document.getElementById('deck-config-modal');
    const targetLangModal = document.getElementById('target-languages-modal');

    // Open Deck Config
    const openDeckConfigBtn = document.getElementById('open-deck-config-btn');
    if (openDeckConfigBtn && deckConfigModal) {
        openDeckConfigBtn.addEventListener('click', (e) => {
            e.preventDefault();
            deckConfigModal.classList.remove('hidden');
        });
    }

    // Close Deck Config
    document.getElementById('close-deck-config-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        deckConfigModal.classList.add('hidden');
    });
    document.getElementById('discard-config-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        deckConfigModal.classList.add('hidden');
    });
    document.getElementById('save-config-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof saveState === 'function') saveState();
        deckConfigModal.classList.add('hidden');
    });

    // Open Target Lang
    const openTargetLangBtn = document.getElementById('open-target-lang-btn');
    if (openTargetLangBtn && targetLangModal) {
        openTargetLangBtn.addEventListener('click', (e) => {
            e.preventDefault();
            targetLangModal.classList.remove('hidden');
        });
    }

    // Close Target Lang
    document.getElementById('close-target-lang-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        targetLangModal.classList.add('hidden');
    });
    document.getElementById('cancel-target-lang-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        targetLangModal.classList.add('hidden');
    });
    document.getElementById('save-target-lang-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof saveState === 'function') saveState();
        targetLangModal.classList.add('hidden');
    });


    // Restore Default Prompt
    const restorePromptBtn = document.getElementById('restore-prompt-btn');
    const systemPromptTextarea = document.getElementById('system-prompt');
    if (restorePromptBtn && systemPromptTextarea) {
        restorePromptBtn.addEventListener('click', (e) => {
            e.preventDefault();
            systemPromptTextarea.value = 'You are an expert [MAIN_LANGUAGE] language tutor generating flashcards for an advanced student. The user will provide a word. Return ONLY a raw JSON object matching the schema. Provide translations and contextual examples at B1/B2 level. Identify the part of speech and gender if it is a noun. If the word is invalid, return a JSON object with ONLY an "error" key. No markdown formatting.';
        });
    }


    // Handle toggling language block
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('lang-enable-cb')) {
            const lang = e.target.dataset.lang;
            const optionsDiv = document.querySelector(`.lang-options[data-lang="${lang}"]`);
            if (optionsDiv) {
                const transCb = optionsDiv.querySelector('.lang-trans-cb');
                const exCb = optionsDiv.querySelector('.lang-ex-cb');
                if (e.target.checked) {
                    optionsDiv.classList.remove('opacity-50', 'pointer-events-none');
                    if (transCb) transCb.checked = true;
                    if (exCb) exCb.checked = true;
                } else {
                    optionsDiv.classList.add('opacity-50', 'pointer-events-none');
                    if (transCb) transCb.checked = false;
                    if (exCb) exCb.checked = false;
                }
            }
        }
    });

}



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
    if (elements.deckNameInput) {
        localStorage.setItem('anki_deck_name', elements.deckNameInput.value.trim());
    }
}

function renderTargetLanguages() {
    const container = document.getElementById('target-languages-container');
    if (!container) return;
    container.innerHTML = '';

    // Default languages matching the mockup
    const defaultLangs = [
        { code: 'en', name: 'English', icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9' },
        { code: 'es', name: 'Spanish', icon: 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129' },
        { code: 'de', name: 'German', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
        { code: 'fr', name: 'French', icon: 'M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9' },
        { code: 'it', name: 'Italian', icon: 'M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z' }
    ];

    defaultLangs.forEach(lang => {
        let isEnabled = lang.code === 'en';
        let doTrans = lang.code === 'en';
        let doEx = lang.code === 'en';

        const storedTrans = localStorage.getItem(`lang_${lang.code}_trans`);
        if (storedTrans !== null) {
            doTrans = storedTrans === 'true';
            doEx = localStorage.getItem(`lang_${lang.code}_ex`) === 'true';
            isEnabled = doTrans || doEx;
        }

        const opacityClass = isEnabled ? '' : 'opacity-50 pointer-events-none';

        const div = document.createElement('div');
        div.className = 'target-lang-item bg-bg-overlay border border-border-subtle rounded-lg p-4 mb-2';
        div.innerHTML = `
            <div class="flex justify-between items-center mb-3">
                <div class="flex items-center gap-2 text-sm font-semibold text-on-surface">
                    <svg class="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${lang.icon}"></path></svg>
                    ${lang.name}
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" class="sr-only peer lang-enable-cb" data-lang="${lang.code}" ${isEnabled ? 'checked' : ''}>
                    <div class="w-9 h-5 bg-bg-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-on-surface after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-muted peer-checked:after:bg-on-surface after:border-border-subtle after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-electric-orange"></div>
                </label>
            </div>
            <div class="ml-6 space-y-2 pl-2 border-l border-border-subtle lang-options ${opacityClass}" data-lang="${lang.code}">
                <label class="flex items-center gap-2 cursor-pointer text-xs text-on-surface">
                    <input type="checkbox" class="lang-trans-cb appearance-none w-4 h-4 border border-border-subtle rounded bg-bg-surface checked:bg-electric-orange checked:border-electric-orange flex items-center justify-center after:content-['✓'] after:text-on-surface after:text-[10px] after:hidden checked:after:block" data-lang="${lang.code}" value="${lang.code}" ${doTrans ? 'checked' : ''}>
                    Translation
                </label>
                <label class="flex items-center gap-2 cursor-pointer text-xs text-on-surface">
                    <input type="checkbox" class="lang-ex-cb appearance-none w-4 h-4 border border-border-subtle rounded bg-bg-surface checked:bg-electric-orange checked:border-electric-orange flex items-center justify-center after:content-['✓'] after:text-on-surface after:text-[10px] after:hidden checked:after:block" data-lang="${lang.code}" value="${lang.code}" ${doEx ? 'checked' : ''}>
                    Examples
                </label>
            </div>
        `;
        container.appendChild(div);
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { callGeminiAPI, getSelectedLanguages, generateDynamicSchema };
}
