document.addEventListener('DOMContentLoaded', () => {
    let fullDeck = []; // The entire loaded deck
    let sessionDeck = []; // The cards scheduled for this study session
    let currentIndex = 0;
    let isFlipped = false;
    let langSettings = { mainLang: 'en', targets: [] };
    let deckName = 'Default Deck';

    // Elements
    const studyContainer = document.getElementById('study-container');
    const emptyState = document.getElementById('empty-state');
    const emptyTitle = document.getElementById('empty-title');
    const emptySubtitle = document.getElementById('empty-subtitle');
    const flashcard = document.getElementById('flashcard');
    const cardFrontContent = document.getElementById('card-front-content');
    const cardBackContent = document.getElementById('card-back-content');
    const cardControls = document.getElementById('card-controls');

    // SRS Buttons
    const btnAgain = document.getElementById('btn-again');
    const btnHard = document.getElementById('btn-hard');
    const btnGood = document.getElementById('btn-good');
    const btnEasy = document.getElementById('btn-easy');

    // UI displays
    const deckStatus = document.getElementById('deck-status');
    const studyProgress = document.getElementById('study-progress');
    const deckNameDisplay = document.getElementById('deck-name-display');

    // Batch settings
    const batchSizeInput = document.getElementById('batch-size-input');
    const startBatchBtn = document.getElementById('start-batch-btn');
    const batchConfigContainer = document.getElementById('batch-config-container');

    // Import/Export
    const importJsonBtn = document.getElementById('import-json-btn');
    const importJsonFile = document.getElementById('import-json-file');
    const exportJsonBtn = document.getElementById('export-json-btn');

    // Global audio function matching Anki template logic
    window.playAudio = function(text) {
        if (!window.speechSynthesis) {
            console.error('Speech synthesis not supported');
            return;
        }

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const msg = new SpeechSynthesisUtterance(text);

        // Attempt to map our lang code to TTS lang code
        const langMap = {
            'en': 'en-US',
            'es': 'es-ES',
            'fr': 'fr-FR',
            'de': 'de-DE',
            'it': 'it-IT',
            'pl': 'pl-PL',
            'pt': 'pt-PT'
        };

        msg.lang = langMap[langSettings.mainLang] || `${langSettings.mainLang}-${langSettings.mainLang.toUpperCase()}`;

        // Get speed from localStorage if available
        const ttsSpeedStr = localStorage.getItem('tts_speed') || '1.0';
        msg.rate = parseFloat(ttsSpeedStr);

        window.speechSynthesis.speak(msg);
    };

    function loadDeck() {
        try {
            const stagedWordsJson = localStorage.getItem('anki_staged_words');
            if (stagedWordsJson) {
                fullDeck = JSON.parse(stagedWordsJson);
            } else {
                fullDeck = [];
            }

            const savedDeckName = localStorage.getItem('anki_deck_name');
            if (savedDeckName) {
                deckName = savedDeckName;
            }
            deckNameDisplay.textContent = deckName;

            const langSettingsJson = localStorage.getItem('anki_lang_settings');
            if (langSettingsJson) {
                langSettings = JSON.parse(langSettingsJson);
            } else {
                // Try to infer from main page elements if possible, otherwise defaults
                langSettings = {
                    mainLang: localStorage.getItem('last_main_lang') || 'en',
                    targets: []
                };
            }
        } catch (e) {
            console.error("Error loading deck:", e);
            fullDeck = [];
        }

        if (fullDeck.length === 0) {
            showEmptyState("Deck is Empty", "Go back to the Deck page to generate some flashcards.", false);
        } else {
            prepareSession();
        }
    }

    function prepareSession() {
        // Find due cards (cards that have a dueDate <= now)
        const now = Date.now();
        const dueCards = [];
        const newCards = [];

        fullDeck.forEach(card => {
            // Initialize SRS fields if they don't exist
            if (!card.srs) {
                card.srs = {
                    dueDate: 0,
                    interval: 0,
                    ease: 2.5,
                    step: 0 // 0: learning, 1: graduating
                };
            }

            if (card.srs.dueDate <= now) {
                if (card.srs.interval === 0 && card.srs.step === 0) {
                    newCards.push(card);
                } else {
                    dueCards.push(card);
                }
            }
        });

        // If we have due cards or new cards, ask for batch size if they are only new, or just start if there are actual reviews
        if (dueCards.length > 0) {
            // Prioritize due cards
            sessionDeck = dueCards;
            startStudy();
        } else if (newCards.length > 0) {
            // Ask how many new cards to do
            showEmptyState("Ready to Study", `You have ${newCards.length} new cards available.`, true);
        } else {
            showEmptyState("Deck Finished", "You have reviewed all due cards. Great job!", false);
        }
    }

    function startCustomBatch() {
        const batchSize = parseInt(batchSizeInput.value, 10) || 20;

        const newCards = fullDeck.filter(card => (!card.srs || (card.srs.interval === 0 && card.srs.step === 0)) && (card.srs ? card.srs.dueDate <= Date.now() : true));

        sessionDeck = newCards.slice(0, batchSize);

        if (sessionDeck.length > 0) {
            startStudy();
        } else {
            showEmptyState("Deck Finished", "No new cards left to review.", false);
        }
    }

    function saveDeckState() {
        localStorage.setItem('anki_staged_words', JSON.stringify(fullDeck));
    }

    function startStudy() {
        currentIndex = 0;
        studyContainer.classList.remove('hidden');
        emptyState.classList.add('hidden');
        updateProgress();
        renderCurrentCard();
    }

    function showEmptyState(title, subtitle, showBatchConfig = false) {
        studyContainer.classList.add('hidden');
        emptyState.classList.remove('hidden');
        if (title) emptyTitle.textContent = title;
        if (subtitle) emptySubtitle.textContent = subtitle;

        if (showBatchConfig) {
            batchConfigContainer.classList.remove('hidden');
        } else {
            batchConfigContainer.classList.add('hidden');
        }
    }

    function updateProgress() {
        deckStatus.textContent = `${currentIndex + 1} / ${sessionDeck.length}`;
        const percent = ((currentIndex) / sessionDeck.length) * 100;
        studyProgress.style.width = `${percent}%`;
    }

    function renderCurrentCard() {
        isFlipped = false;
        flashcard.classList.remove('flipped');
        cardControls.classList.add('opacity-0', 'pointer-events-none');
        cardControls.classList.remove('opacity-100', 'pointer-events-auto');

        // Reset scroll position for the back side
        const flipCardBack = document.querySelector('.flip-card-back');
        if (flipCardBack) {
            flipCardBack.scrollTop = 0;
        }

        const groupObj = sessionDeck[currentIndex];

        // Update SRS Button intervals based on current card's state
        updateSrsButtonLabels(groupObj);
        if (!groupObj || !groupObj._words || groupObj._words.length === 0) {
            cardFrontContent.innerHTML = '<div class="text-red-500">Error loading card data</div>';
            return;
        }

        const mainLang = langSettings.mainLang;
        const targets = langSettings.targets || [];
        const mainWordKey = `word_${mainLang}`;
        const mainRootKey = `root_${mainLang}`;

        // Pre-filter targets
        const translationTargets = [];
        const exampleTargets = [];
        for (let i = 0; i < targets.length; i++) {
            const t = targets[i];
            if (t.translation) {
                translationTargets.push({ lang: t.lang, upperLang: t.lang.toUpperCase(), transKey: `translation_${t.lang}` });
            }
            if (t.examples) {
                exampleTargets.push({ lang: t.lang });
            }
        }

        // --- FRONT ---
        const frontText = groupObj._words.map(w => w[mainWordKey]).join(', ');

        let frontHtml = `<div class="word" style="font-size: 48px; margin-top: 20px;">${frontText}</div>`;

        // Front play button (matching screenshot 2 style loosely, but it's mainly for the Anki UI)
        // Adding it here for study convenience
        const safeFrontText = frontText.replace(/'/g, "\\'");
        frontHtml += `<div class="mt-8"><button class="play-btn !p-4 !rounded-2xl bg-[#27272A] hover:bg-[#3F3F46] border-none" onclick="event.stopPropagation(); window.playAudio('${safeFrontText}')"><svg class="!m-0 w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></button></div>`;

        cardFrontContent.innerHTML = frontHtml;

        // --- BACK ---
        let backHtml = `<div class="word-back" style="font-size: 42px; margin-bottom: 20px;">${frontText}</div>`;

        const root = groupObj[mainRootKey] || groupObj._words[0][mainRootKey] || '';
        if (root) {
            backHtml += `<div class="root-badge"><span class="root-badge-label">ROOT:</span> ${root}</div>`;
        }

        if (groupObj._words.length > 0 && root) {
            backHtml += `<hr class="card-hr">`;
        }

        for (let i = 0; i < groupObj._words.length; i++) {
             const w = groupObj._words[i];
             const pos = w.part_of_speech || groupObj._words[0].part_of_speech || '';

             backHtml += `<div class="word-block text-left">`;
             backHtml += `<div class="sub-word text-center">word: ${w[mainWordKey]}</div>`;

             if (pos) {
                 backHtml += `<div class="pos text-center">part_of_speech: ${pos}</div>`;
             }

             // Translations
             for (let k = 0; k < translationTargets.length; k++) {
                 const t = translationTargets[k];
                 const trans = w[t.transKey];
                 if (trans) {
                     backHtml += `<div class="translation text-center mt-4">${t.upperLang}: ${trans}</div>`;
                 }
             }

             // Examples
             const maxExamples = 2;
             for (let num = 1; num <= maxExamples; num++) {
                 const mainEx = w[`example_${num}_${mainLang}`];
                 if (mainEx) {
                    backHtml += `<div class="example-block mt-6 text-center">`;
                    backHtml += `<div class="example text-[15px]">Example ${num}: ${mainEx}</div>`;

                    const safeMainEx = mainEx.replace(/'/g, "\\'");
                    backHtml += `<button class="play-btn" onclick="event.stopPropagation(); window.playAudio('${safeMainEx}')">
                        <svg fill="currentColor" viewBox="0 0 24 24"><path d="M13 5v14l8-7z M3 9v6h4l5 5V4L7 9z"/></svg> Play Audio
                    </button>`;

                    for (let k = 0; k < exampleTargets.length; k++) {
                        const tgtEx = w[`example_${num}_${exampleTargets[k].lang}`];
                        if (tgtEx) {
                            backHtml += `<div class="example-trans text-sm mt-2">${tgtEx}</div>`;
                        }
                    }

                    backHtml += `</div>`;
                 }
             }

             backHtml += `</div>`;
        }

        cardBackContent.innerHTML = backHtml;
    }

    // Event Listeners
    flashcard.addEventListener('click', () => {
        if (!isFlipped) {
            flashcard.classList.add('flipped');
            isFlipped = true;

            setTimeout(() => {
                cardControls.classList.remove('opacity-0', 'pointer-events-none');
                cardControls.classList.add('opacity-100', 'pointer-events-auto');
            }, 300);
        }
    });

    // SRS Logic
    function updateSrsButtonLabels(card) {
        const srs = card.srs || { interval: 0, step: 0 };

        if (srs.interval === 0) {
            // Learning phase
            document.getElementById('interval-again').textContent = '< 1m';
            document.getElementById('interval-hard').textContent = '6m';
            document.getElementById('interval-good').textContent = '10m';
            document.getElementById('interval-easy').textContent = '4d';
        } else {
            // Review phase
            document.getElementById('interval-again').textContent = '< 10m';
            document.getElementById('interval-hard').textContent = formatInterval(srs.interval * 1.2);
            document.getElementById('interval-good').textContent = formatInterval(srs.interval * srs.ease);
            document.getElementById('interval-easy').textContent = formatInterval(srs.interval * srs.ease * 1.3);
        }
    }

    function formatInterval(days) {
        if (days < 1) {
            const hours = Math.round(days * 24);
            return hours + 'h';
        } else if (days < 30) {
            return Math.round(days) + 'd';
        } else if (days < 365) {
            return Math.round(days / 30) + 'mo';
        } else {
            return (days / 365).toFixed(1) + 'y';
        }
    }

    function processSrsAnswer(quality) {
        const card = sessionDeck[currentIndex];
        const srs = card.srs;
        const now = Date.now();
        const minute = 60 * 1000;
        const day = 24 * 60 * minute;

        // Quality: 0 = Again, 1 = Hard, 2 = Good, 3 = Easy
        if (srs.interval === 0) {
            // Learning
            if (quality === 0) {
                srs.step = 0;
                srs.dueDate = now + (1 * minute);
                // Push to back of current session to see again
                sessionDeck.push(card);
            } else if (quality === 1) {
                srs.dueDate = now + (6 * minute);
                sessionDeck.push(card);
            } else if (quality === 2) {
                srs.step = 1;
                srs.interval = 1; // Graduates to 1 day
                srs.dueDate = now + (10 * minute);
                // In a real strict SRS, it stays in learning queue, but we'll graduate it here for simplicity
                sessionDeck.push(card); // Review one more time today
            } else if (quality === 3) {
                srs.interval = 4;
                srs.dueDate = now + (4 * day);
            }

            // If it graduates during the learning phase and wasn't easy, we set interval based on step 1 graduation
            if (quality === 2 && srs.step === 1 && srs.interval === 1) {
                srs.interval = 1;
                srs.dueDate = now + (1 * day);
            }
        } else {
            // Reviewing
            if (quality === 0) {
                srs.ease = Math.max(1.3, srs.ease - 0.2);
                srs.interval = srs.interval * 0.2; // Drop interval heavily
                if (srs.interval < 1) srs.interval = 1;
                srs.dueDate = now + (10 * minute);
                sessionDeck.push(card); // Review again today
            } else if (quality === 1) {
                srs.ease = Math.max(1.3, srs.ease - 0.15);
                srs.interval = srs.interval * 1.2;
                srs.dueDate = now + (srs.interval * day);
            } else if (quality === 2) {
                srs.interval = srs.interval * srs.ease;
                srs.dueDate = now + (srs.interval * day);
            } else if (quality === 3) {
                srs.ease += 0.15;
                srs.interval = srs.interval * srs.ease * 1.3;
                srs.dueDate = now + (srs.interval * day);
            }
        }

        saveDeckState();
        advanceCard();
    }

    function advanceCard() {
        // Stop any currently playing audio
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }

        currentIndex++;
        if (currentIndex >= sessionDeck.length) {
            studyProgress.style.width = '100%';
            setTimeout(() => {
                showEmptyState("Session Finished", "You have completed your reviews for this batch.", false);
            }, 300);
        } else {
            updateProgress();
            renderCurrentCard();
        }
    }

    // SRS Event Listeners
    btnAgain.addEventListener('click', (e) => { e.stopPropagation(); processSrsAnswer(0); });
    btnHard.addEventListener('click', (e) => { e.stopPropagation(); processSrsAnswer(1); });
    btnGood.addEventListener('click', (e) => { e.stopPropagation(); processSrsAnswer(2); });
    btnEasy.addEventListener('click', (e) => { e.stopPropagation(); processSrsAnswer(3); });

    startBatchBtn.addEventListener('click', startCustomBatch);

    // Import / Export
    exportJsonBtn.addEventListener('click', () => {
        if (fullDeck.length === 0) {
            alert("No deck to export.");
            return;
        }
        const projectData = {
            deckName: deckName,
            words: fullDeck
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projectData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${deckName.replace(/\s+/g, '_')}_project_with_srs.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    });

    importJsonFile.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                if (data.words && Array.isArray(data.words)) {
                    fullDeck = data.words;
                    localStorage.setItem('anki_staged_words', JSON.stringify(fullDeck));

                    if (data.deckName) {
                        deckName = data.deckName;
                        localStorage.setItem('anki_deck_name', deckName);
                        deckNameDisplay.textContent = deckName;
                    }

                    alert('Project loaded successfully! Your progress has been restored.');
                    loadDeck(); // Reload UI
                } else {
                    throw new Error("Invalid format");
                }
            } catch (error) {
                alert('Error loading JSON file. Make sure it is a valid project file.');
                console.error(error);
            }
            event.target.value = '';
        };
        reader.readAsText(file);
    });

    // Handle keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (sessionDeck.length === 0 || studyContainer.classList.contains('hidden')) return;

        if (e.code === 'Space' || e.code === 'Enter') {
            e.preventDefault();
            if (!isFlipped) {
                flashcard.click();
            } else {
                // Default to Good if space is pressed when flipped
                btnGood.click();
            }
        } else if (isFlipped) {
            if (e.code === 'Digit1') btnAgain.click();
            if (e.code === 'Digit2') btnHard.click();
            if (e.code === 'Digit3') btnGood.click();
            if (e.code === 'Digit4') btnEasy.click();
        }
    });

    // Init
    loadDeck();
});
