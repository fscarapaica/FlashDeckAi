# Deck Page (index.html) Context

## Purpose
The Deck page is the main entry point and builder interface of FlashDeckAi. It allows the user to configure settings, input target vocabulary, generate rich language data using the Gemini API, review and edit generated items, and export them into an Anki package (`.apkg`).

## Key Features & Functionality
1. **Configuration Modals**:
   - **Deck Configuration**: Sets the main target language (e.g., Polish), overall deck name, and basic TTS speed preferences.
   - **Target Languages & Outputs**: Sets up to what languages the root words should be translated to, and whether examples should be generated.
   - **API Key & Model Selection**: Users must input a Gemini API key. Once valid, models are loaded dynamically.
2. **Data Input**:
   - Users can type or paste a list of words (newline or comma-separated) into a textarea.
   - Users can import words from `.txt`, `.csv`, and `.md` files.
3. **Card Generation**:
   - Triggering the build process queries the Gemini API for each word concurrently.
   - The AI identifies the root, parts of speech, generates translations (based on selected target languages), and example sentences.
   - A visual progress bar tracks the generation status. Failed words are left in the input box for retry.
4. **Staging Area**:
   - Generated results are displayed in a staging area grouped by their "root" word.
   - Words with the same root are automatically merged into a single item.
   - Users can visually review the translations and examples, which are color-coded by language.
   - Users can click "Edit" to manually adjust any of the generated fields via an edit modal.
   - Users can delete specific words from a group.
5. **State Persistence**:
   - The current list of generated words, along with language configuration, is saved to the browser's `localStorage` (`anki_staged_words`, `anki_lang_settings`). This allows the user to navigate away or close the browser without losing their pending deck.
6. **Export**:
   - The "Export to Anki" button packages the staged words into an Anki `.apkg` file using `genanki-js` and `sql.js`, applying specific HTML/CSS templates to format the cards nicely for Anki Desktop/Mobile.
