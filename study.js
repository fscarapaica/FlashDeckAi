document.addEventListener('DOMContentLoaded', () => {
    let deck = [];
    let currentIndex = 0;
    let isFlipped = false;
    let langSettings = { mainLang: 'en', targets: [] };

    // Elements
    const studyContainer = document.getElementById('study-container');
    const emptyState = document.getElementById('empty-state');
    const emptyTitle = document.getElementById('empty-title');
    const emptySubtitle = document.getElementById('empty-subtitle');
    const flashcard = document.getElementById('flashcard');
    const cardFrontContent = document.getElementById('card-front-content');
    const cardBackContent = document.getElementById('card-back-content');
    const cardControls = document.getElementById('card-controls');
    const nextBtn = document.getElementById('next-btn');
    const resetStudyBtn = document.getElementById('reset-study-btn');
    const deckStatus = document.getElementById('deck-status');
    const studyProgress = document.getElementById('study-progress');

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
                deck = JSON.parse(stagedWordsJson);
            }

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
            deck = [];
        }

        if (deck.length === 0) {
            showEmptyState("Deck is Empty", "Go back to the Deck page to generate some flashcards.");
        } else {
            startStudy();
        }
    }

    function startStudy() {
        currentIndex = 0;
        studyContainer.classList.remove('hidden');
        emptyState.classList.add('hidden');
        updateProgress();
        renderCurrentCard();
    }

    function showEmptyState(title, subtitle) {
        studyContainer.classList.add('hidden');
        emptyState.classList.remove('hidden');
        if (title) emptyTitle.textContent = title;
        if (subtitle) emptySubtitle.textContent = subtitle;
    }

    function updateProgress() {
        deckStatus.textContent = `${currentIndex + 1} / ${deck.length}`;
        const percent = ((currentIndex) / deck.length) * 100;
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

        const groupObj = deck[currentIndex];
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

    nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();

        // Stop any currently playing audio
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }

        currentIndex++;
        if (currentIndex >= deck.length) {
            studyProgress.style.width = '100%';
            setTimeout(() => {
                showEmptyState("Deck Finished", "You have reviewed all cards in this deck.");
            }, 300);
        } else {
            updateProgress();
            renderCurrentCard();
        }
    });

    resetStudyBtn.addEventListener('click', () => {
        startStudy();
    });

    // Handle keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (deck.length === 0 || studyContainer.classList.contains('hidden')) return;

        if (e.code === 'Space' || e.code === 'Enter') {
            e.preventDefault();
            if (!isFlipped) {
                flashcard.click();
            } else {
                nextBtn.click();
            }
        }
    });

    // Init
    loadDeck();
});
