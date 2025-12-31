# Project Context: AI-to-AI Conversation Loop

## 1. Project Overview
We are building a web application where two distinct AI agents ("Bot A" and "Bot B") converse with each other autonomously. The user provides a topic, and the two agents debate or discuss it while the user watches the conversation unfold in real-time.

## 2. Tech Stack
* **Backend:** Python (Flask)
* **Frontend:** HTML5, CSS3 (Modern, Clean UI), Vanilla JavaScript
* **AI Provider:** OpenAI API (using `gpt-3.5-turbo` or `gpt-4o`) and Gemini API
* **Environment:** `.env` file for API key management

## 3. Core Features & Logic
### A. The Conversation Loop
The application relies on a "turn-taking" logic. It does not generate the whole conversation at once.
1.  **User Input:** User enters a topic (e.g., "Is coffee healthy?").
2.  **Initialization:** The server sets the system prompts for Bot A (e.g., Optimist) and Bot B (e.g., Skeptic).
3.  **Step-by-Step Execution:**
    * The frontend calls the `/next_turn` endpoint.
    * The server takes the full conversation history.
    * The server determines whose turn it is.
    * The server sends the history to the OpenAI API with the *current* bot's system persona.
    * The API response is appended to the history.
    * The response is sent back to the frontend to be displayed.
4.  **Termination:** The loop stops when a maximum number of turns is reached or the user clicks "Stop".

### B. The Personas
* **Bot A:** The "Optimist" (or Proponent). Always argues in favor of the topic or looks at the bright side. Short, punchy sentences.
* **Bot B:** The "Skeptic" (or Critic). Always questions the topic or points out flaws. Analytical tone.

## 4. File Structure
```text
/ai-conversation-app
│
├── .env                  # Contains OPENAI_API_KEY
├── .gitignore            # Ignores .env and __pycache__
├── requirements.txt      # flask, openai, python-dotenv
├── app.py                # Main Flask application logic
└── templates/
    └── index.html        # Single page UI with chat interface and JS logic