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

    // Dashboard Stats
    const statDue = document.getElementById('stat-due');
    const statNew = document.getElementById('stat-new');
    const statStudied = document.getElementById('stat-studied');
    const statTotal = document.getElementById('stat-total');

    // Batch settings
    const startDueBtn = document.getElementById('start-due-btn');
    const batchConfigContainer = document.getElementById('batch-config-container');
    const batchBtns = document.querySelectorAll('.batch-btn');
    const startCramBtn = document.getElementById('start-cram-btn');

    let isCramMode = false;

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
            showDashboard();
        }
    }

    function getTodayString() {
        const d = new Date();
        return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
    }

    function updateStudyStats() {
        const todayStr = getTodayString();
        let studyStats = { date: todayStr, count: 0 };

        try {
            const savedStats = localStorage.getItem('anki_study_stats');
            if (savedStats) {
                const parsed = JSON.parse(savedStats);
                if (parsed.date === todayStr) {
                    studyStats = parsed;
                }
            }
        } catch (e) {}

        studyStats.count++;
        localStorage.setItem('anki_study_stats', JSON.stringify(studyStats));
        return studyStats.count;
    }

    function getStudiedTodayCount() {
        const todayStr = getTodayString();
        try {
            const savedStats = localStorage.getItem('anki_study_stats');
            if (savedStats) {
                const parsed = JSON.parse(savedStats);
                if (parsed.date === todayStr) {
                    return parsed.count;
                }
            }
        } catch (e) {}
        return 0;
    }

    function showDashboard() {
        const now = Date.now();
        let dueCount = 0;
        let newCount = 0;

        fullDeck.forEach(card => {
            if (!card.srs) {
                card.srs = { dueDate: 0, interval: 0, ease: 2.5, step: 0 };
            }

            if (card.srs.dueDate <= now) {
                if (card.srs.interval === 0 && card.srs.step === 0) {
                    newCount++;
                } else {
                    dueCount++;
                }
            }
        });

        statDue.textContent = dueCount;
        statNew.textContent = newCount;
        statTotal.textContent = fullDeck.length;
        statStudied.textContent = getStudiedTodayCount();

        deckStatus.textContent = "Ready";

        showEmptyState("Deck Dashboard", "Ready for your session?", true);

        // Start buttons logic
        if (dueCount > 0) {
            startDueBtn.classList.remove('hidden');
            startDueBtn.textContent = `Review Due Cards (${dueCount})`;
        } else {
            startDueBtn.classList.add('hidden');
        }

        if (newCount > 0) {
            batchConfigContainer.classList.remove('hidden');
        } else {
            batchConfigContainer.classList.add('hidden');
        }
    }

    function startDueSession() {
        const now = Date.now();
        sessionDeck = fullDeck.filter(card => card.srs && card.srs.dueDate <= now && (card.srs.interval > 0 || card.srs.step > 0));

        if (sessionDeck.length > 0) {
            isCramMode = false;
            startStudy();
        }
    }

    function startNewBatch(size) {
        const now = Date.now();
        const newCards = fullDeck.filter(card => !card.srs || (card.srs.interval === 0 && card.srs.step === 0));

        sessionDeck = newCards.slice(0, size);

        if (sessionDeck.length > 0) {
            isCramMode = false;
            startStudy();
        }
    }

    function startCramSession() {
        // Grab up to 20 most recently added/modified cards (assuming fullDeck is newest first from index page behavior)
        sessionDeck = fullDeck.slice(0, 20);

        if (sessionDeck.length > 0) {
            isCramMode = true;
            startStudy();
        } else {
            alert("No cards available to review.");
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
        const safeFrontText = frontText.replace(/"/g, "&quot;");
        frontHtml += `<div class="mt-8"><button class="play-btn play-audio-btn !p-4 !rounded-2xl bg-[#27272A] hover:bg-[#3F3F46] border-none" data-text="${safeFrontText}"><svg class="!m-0 w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></button></div>`;

        cardFrontContent.innerHTML = frontHtml;

        // Autoplay the front audio
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const msg = new SpeechSynthesisUtterance(frontText);
            msg.lang = `${mainLang}-${mainLang.toUpperCase()}`;
            msg.rate = langSettings.ttsSpeed || 1.0;
            window.speechSynthesis.speak(msg);
        }

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

             backHtml += `<div class="pos-container">`;
             if (pos) {
                 backHtml += `<div class="pos">part_of_speech: ${pos}</div>`;
             }
             backHtml += `</div>`;

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
             let exampleCount = 0;
             for (let num = 1; num <= maxExamples; num++) {
                 const mainEx = w[`example_${num}_${mainLang}`];
                 if (mainEx) {
                    if (exampleCount > 0) {
                        backHtml += `<hr class="card-hr border-dashed w-3/5 mx-auto opacity-50 mt-6">`;
                    }
                    backHtml += `<div class="example-block mt-6 text-center">`;

                    const safeMainEx = mainEx.replace(/"/g, "&quot;");
                    backHtml += `<button class="play-btn play-audio-btn mb-3" data-text="${safeMainEx}">
                        <svg fill="currentColor" viewBox="0 0 24 24"><path d="M13 5v14l8-7z M3 9v6h4l5 5V4L7 9z"/></svg> Play Audio
                    </button>`;

                    backHtml += `<div class="example text-[15px]">Example ${num}: ${mainEx}</div>`;

                    for (let k = 0; k < exampleTargets.length; k++) {
                        const tgtEx = w[`example_${num}_${exampleTargets[k].lang}`];
                        if (tgtEx) {
                            backHtml += `<div class="example-trans text-sm mt-2">${tgtEx}</div>`;
                        }
                    }

                    backHtml += `</div>`;
                    exampleCount++;
                 }
             }

             // Tags (Bottom of card word-block)
             if (w.tags && w.tags.length > 0) {
                 backHtml += `<div class="tags-container mt-6">`;
                 w.tags.forEach(tag => {
                     const safeTag = tag.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
                     backHtml += `<span class="tag-badge">${safeTag}</span>`;
                 });
                 backHtml += `</div>`;
             }

             backHtml += `</div>`;
        }

        cardBackContent.innerHTML = backHtml;
    }

    // Event Listeners
    flashcard.addEventListener('click', (e) => {
        // Handle play audio buttons
        let target = e.target;
        while (target && target !== flashcard) {
            if (target.classList && target.classList.contains('play-audio-btn')) {
                e.stopPropagation();
                const text = target.getAttribute('data-text');
                if (text) {
                    window.playAudio(text);
                }
                return;
            }
            target = target.parentNode;
        }

        // Handle flip
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

        if (!isCramMode) {
            saveDeckState();
            updateStudyStats();
        }
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
                showDashboard(); // Return to dashboard instead of a dead end
                document.getElementById('empty-title').textContent = "Great Job!";
                document.getElementById('empty-subtitle').textContent = "You have completed the session.";
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

    // Session Starters
    startDueBtn.addEventListener('click', startDueSession);

    batchBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const size = parseInt(e.target.getAttribute('data-size'), 10);
            startNewBatch(size);
        });
    });

    startCramBtn.addEventListener('click', startCramSession);

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

    if (importJsonBtn && importJsonFile) {
        importJsonBtn.addEventListener('click', () => {
            importJsonFile.click();
        });
    }

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
                    showDashboard(); // Reload UI
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
