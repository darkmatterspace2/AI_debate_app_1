# Project Context: AI-to-AI Conversation Loop

## 1. Project Overview
We are building a **Client-Side** web application where two distinct AI agents ("Bot A" and "Bot B") converse with each other autonomously. The user provides a topic, and the two agents debate or discuss it while the user watches the conversation unfold in real-time.

## 2. Tech Stack
*   **Architecture:** Client-Side Only (No Backend Server required).
*   **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES Modules).
*   **AI Providers:**
    *   **OpenAI:** Uses `gpt-3.5-turbo` (configurable via code/settings).
    *   **Google Gemini:** Uses `gemini-1.5-flash` or `gemini-2.5-flash-preview` (configurable).
*   **Configuration:** `.env` file (loaded via client-side fetch) or Local Storage.

## 3. Core Features & Logic
### A. The Conversation Loop
The application logic runs entirely in the browser (`js/app.js`).
1.  **User Input:** User enters a topic (e.g., "Is coffee healthy?").
2.  **Initialization:** The app sets system prompts for Bot A (Optimist) and Bot B (Skeptic).
3.  **Step-by-Step Execution:**
    *   The Javascript loop (`runTurn`) determines whose turn it is.
    *   It constructs a message history based on previous turns.
    *   It calls the selected API (OpenAI or Gemini) directly via `fetch`.
    *   The response is displayed in the chat UI.
    *   **Text-to-Speech:** The response is spoken aloud using the browser's `speechSynthesis` API.
    *   **Delays:** The loop waits for a user-configured duration (Speed Control) before triggering the next turn.
4.  **Termination:** The loop stops when a maximum number of turns is reached or the user clicks "Stop".

### B. Controls
*   **API Settings:** Choose provider (OpenAI/Gemini) and input API Keys.
*   **Speed Control:** Slider to adjust the wait time between turns (5s - 60s).
*   **Audio Control:** Toggle button (🔊/🔇) to mute/unmute text-to-speech.

### C. The Personas
*   **Bot A:** The "Optimist". Cheerful, encouraging, sees the bright side. (Female/Light Voice).
*   **Bot B:** The "Skeptic". Critical, analytical, sees the flaws. (Male/Deep Voice).

## 4. File Structure
```text
/AI_Bot_debate
│
├── .env                  # API Keys (loaded by browser if served correctly)
├── .vscode/              # VS Code settings (Live Server config)
├── index.html            # Main UI
├── css/
│   └── style.css         # Styles
└── js/
    ├── api.js            # API Wrapper functions (OpenAI, Gemini)
    └── app.js            # Main application logic (State, Loop, UI, TTS)
```