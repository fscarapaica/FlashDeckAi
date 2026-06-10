# FlashDeckAi

## About the Project
FlashDeckAi is an intelligent, frontend-only application designed to supercharge your language learning experience. By leveraging the power of the Gemini API, it acts as both a deck builder and a study tool. Users can input target vocabulary, and the application will automatically identify root words, parts of speech, and generate translations along with context-rich example sentences across multiple languages.

The application features a built-in staging area for reviewing and editing generated content before exporting it directly to an Anki deck (`.apkg`), complete with styled HTML templates. Additionally, it offers an in-browser study mode with Anki-like Spaced Repetition System (SRS) integration, and allows exporting/importing JSON project states (including SRS review history).

## Accessing the Application
You can access and use FlashDeckAi directly via its GitHub Pages URL:
**[https://fscarapaica.github.io/FlashDeckAi/](https://fscarapaica.github.io/FlashDeckAi/)**

Since this is a client-side web application, everything runs in your browser.

## Project Structure
The repository is structured to support both a vanilla web frontend and a Python development/testing environment:

- **Frontend Application**
  - `index.html` & `app.js`: The main deck builder interface, API integration, and Anki export logic.
  - `study.html` & `study.js`: The standalone in-browser flashcard study mode.
  - `anki-export.js`: Logic for formatting and generating `.apkg` files using `genanki-js` and `sql.js`.
  - `design-guide.md`, `index_page_context.md`, `study_page_context.md`: Context and architecture documentation.
- **Python Backend / Testing**
  - `main.py`: Entry point for backend scripts/utilities.
  - `src/`: Source directory for Python modules.
  - `tests/`: Unit tests and testing utilities for the project.
  - `requirements.txt`: Python dependencies.

## Installation
### Web Application
No installation is required to use the web application. Just visit the URL above.
To run it locally for development, you can use any simple HTTP server. For example:
```bash
python3 -m http.server 3000 --bind 0.0.0.0
```

### Python Utilities
To set up the Python environment:
```bash
pip install -r requirements.txt
```

## Usage
### Web Interface
1. Open the application.
2. Configure your target languages and enter your Gemini API key.
3. Input your vocabulary list.
4. Review the generated cards in the staging area.
5. Export to Anki or study directly in the browser.

### Python Utilities
```bash
python main.py
```

## Testing
To ensure stability, the project contains both Python and JavaScript tests.

**Python Tests:**
```bash
python3 -m unittest discover tests
```

**JavaScript Tests:**
The frontend utilizes the native Node.js test runner for business logic validation:
```bash
node --test
```

## Code Standards
- **JavaScript**: Follows ES6+ best practices, utilizes event delegation over inline event handlers (for security and performance), and prefers `let`/`const` over `var`.
- **Python**: Adheres to PEP 8 standards, utilizes type hinting, and includes standard docstrings.

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
