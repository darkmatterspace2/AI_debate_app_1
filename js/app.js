import { callOpenAI, callGemini } from './api.js';
import { PERSONAS } from './personas.js';

// --- Configuration ---
let maxTurnCount = parseInt(localStorage.getItem('max_turns'), 10) || 10;
// const BOT_A_NAME = 'Bot A'; // Dynamic now
// const BOT_B_NAME = 'Bot B'; // Dynamic now

// --- State ---
let conversationHistory = [];
let isRunning = false;
let turnCount = 0;
let isMuted = false;
let currentTopic = '';
let timeoutId = null;
let currentTheme = localStorage.getItem('theme') || 'dark';
let currentPersonaA = localStorage.getItem('persona_a') || 'optimist';
let currentPersonaB = localStorage.getItem('persona_b') || 'skeptic';
let currentLanguage = localStorage.getItem('language') || 'en-US';
let voiceGenderA = localStorage.getItem('voice_gender_a') || 'auto';
let voiceGenderB = localStorage.getItem('voice_gender_b') || 'auto';

let currentProvider = localStorage.getItem('selected_provider') || 'openai';
let currentModel = localStorage.getItem('selected_model') || 'gpt-3.5-turbo';

let apiKeys = {
    openai: localStorage.getItem('openai_api_key') || '',
    gemini: localStorage.getItem('gemini_api_key') || ''
};

const PROVIDER_MODELS = {
    openai: [
        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
        { value: 'gpt-4o', label: 'GPT-4o' },
        { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' }
    ],
    gemini: [
        { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.0 Flash Lite' },
        { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
        { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
        { value: 'gemma-3-27b-it', label: 'Gemma 3 (27B)' },
        { value: 'gemma-3-12b-it', label: 'Gemma 3 (12B)' },
        { value: 'gemma-3-4b-it', label: 'Gemma 3 (4B)' },
        { value: 'gemma-3-1b-it', label: 'Gemma 3 (1B)' }
    ]
};

const LANG_NAMES = {
    'en-US': 'English',
    'es-ES': 'Spanish',
    'fr-FR': 'French',
    'de-DE': 'German',
    'hi-IN': 'Hindi',
    'ja-JP': 'Japanese',
    'zh-CN': 'Chinese',
    'ru-RU': 'Russian',
    'pt-BR': 'Portuguese',
    'it-IT': 'Italian'
};

// --- TTS State ---
let voices = [];
let botAVoice = null;
let botBVoice = null;
const synth = window.speechSynthesis;

// --- DOM Elements ---
const chatContainer = document.getElementById('chat-container');
const topicInput = document.getElementById('topic-input');
const startBtn = document.getElementById('start-btn');
const resumeBtn = document.getElementById('resume-btn');
const stopBtn = document.getElementById('stop-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const muteBtn = document.getElementById('mute-btn');
const themeBtn = document.getElementById('theme-btn');
const speedSlider = document.getElementById('speed-slider');
const speedValue = document.getElementById('speed-value');

// Settings Inputs
const providerSelect = document.getElementById('provider-select');
const modelSelect = document.getElementById('model-select');
const personaASelect = document.getElementById('persona-a-select');
const personaBSelect = document.getElementById('persona-b-select');
const languageSelect = document.getElementById('language-select');
const voiceGenderASelect = document.getElementById('voice-gender-a');
const voiceGenderBSelect = document.getElementById('voice-gender-b');
const maxTurnsInput = document.getElementById('max-turns');
const openaiWrapper = document.getElementById('openai-wrapper');
const geminiWrapper = document.getElementById('gemini-wrapper');
const apiKeyInput = document.getElementById('api-key');
const geminiKeyInput = document.getElementById('gemini-key');
const saveSettingsBtn = document.getElementById('save-settings-btn');

// --- Initialization ---

async function loadEnv() {
    try {
        const response = await fetch('./.env');
        if (response.ok) {
            const text = await response.text();

            // OpenAI
            const matchOpenAI = text.match(/OPENAI_API_KEY=(.+)/);
            if (matchOpenAI && matchOpenAI[1]) {
                const envKey = matchOpenAI[1].trim();
                if (envKey.length > 20 && !envKey.includes('your-api-key')) {
                    apiKeys.openai = envKey.replace(/"/g, '');
                    console.log('OpenAI Key loaded from .env');
                }
            }

            // Gemini
            const matchGemini = text.match(/GEMINI_API_KEY=(.+)/);
            if (matchGemini && matchGemini[1]) {
                const envKey = matchGemini[1].trim();
                if (envKey.length > 20 && !envKey.includes('your-gemini-key')) {
                    apiKeys.gemini = envKey.replace(/"/g, '');
                    console.log('Gemini Key loaded from .env');
                }
            }
        }
    } catch (e) {
        console.warn('Could not load .env file', e);
    }
}

function updateSettingsUI() {
    if (providerSelect) {
        providerSelect.value = currentProvider;

        // Populate Models
        if (modelSelect) {
            modelSelect.innerHTML = '';
            const models = PROVIDER_MODELS[currentProvider] || [];
            models.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.value;
                opt.innerText = m.label;
                modelSelect.appendChild(opt);
            });

            // Set selected model if it exists in the list, otherwise default to first
            const modelExists = models.find(m => m.value === currentModel);
            if (modelExists) {
                modelSelect.value = currentModel;
            } else {
                modelSelect.value = models[0]?.value || '';
                currentModel = modelSelect.value; // Update state to match UI
            }
        }

        if (currentProvider === 'openai') {
            if (openaiWrapper) openaiWrapper.classList.remove('hidden');
            if (geminiWrapper) geminiWrapper.classList.add('hidden');
        } else {
            if (openaiWrapper) openaiWrapper.classList.add('hidden');
            if (geminiWrapper) geminiWrapper.classList.remove('hidden');
        }
    }

    if (apiKeys.openai && apiKeyInput) apiKeyInput.value = 'Loaded from .env or Configured';
    if (apiKeys.gemini && geminiKeyInput) geminiKeyInput.value = 'Loaded from .env or Configured';

    if (maxTurnsInput) maxTurnsInput.value = maxTurnCount;
    if (languageSelect) languageSelect.value = currentLanguage;
    if (voiceGenderASelect) voiceGenderASelect.value = voiceGenderA;
    if (voiceGenderBSelect) voiceGenderBSelect.value = voiceGenderB;

    // Populate Persona Selectors
    if (personaASelect && personaASelect.options.length === 0) {
        Object.keys(PERSONAS).forEach(key => {
            const p = PERSONAS[key];
            const opt = document.createElement('option');
            opt.value = key;
            opt.innerText = p.name;
            personaASelect.appendChild(opt);
        });
        personaASelect.value = currentPersonaA;
    }

    if (personaBSelect && personaBSelect.options.length === 0) {
        Object.keys(PERSONAS).forEach(key => {
            const p = PERSONAS[key];
            const opt = document.createElement('option');
            opt.value = key;
            opt.innerText = p.name;
            personaBSelect.appendChild(opt);
        });
        personaBSelect.value = currentPersonaB;
    }
}

function initVoices() {
    voices = synth.getVoices();
    console.log('Available Voices:', voices.map(v => `${v.name} (${v.lang})`)); // Debug log

    if (voices.length === 0) return;

    const findVoice = (genderPref) => {
        // 1. Filter by Language Code
        let langCode = currentLanguage.split('-')[0]; // 'hi'
        let langVoices = voices.filter(v => v.lang.startsWith(langCode));

        // 2. Fallback: Filter by Language Name in Voice Name (e.g. "Microsoft Hemant - Hindi")
        if (langVoices.length === 0) {
            const langName = LANG_NAMES[currentLanguage] || '';
            if (langName) {
                langVoices = voices.filter(v => v.name.includes(langName));
            }
        }

        // 3. Fallback: Filter by exact full code match if loose match failed (rare but helpful)
        if (langVoices.length === 0) {
            langVoices = voices.filter(v => v.lang === currentLanguage);
        }

        if (langVoices.length === 0) return null; // No voice for this language found

        // 4. Filter by Gender (Heuristic based on name)
        if (genderPref === 'female') {
            return langVoices.find(v => v.name.includes('Female') || v.name.includes('Woman') || v.name.includes('Girl') || v.name.includes('Samantha') || v.name.includes('Zira') || v.name.includes('Kalpana')) || langVoices[0];
        } else if (genderPref === 'male') {
            return langVoices.find(v => v.name.includes('Male') || v.name.includes('Man') || v.name.includes('Boy') || v.name.includes('David') || v.name.includes('Hemant')) || langVoices[0];
        }
        return langVoices[0];
    };

    // Bot A
    let genderA = voiceGenderA;
    if (genderA === 'auto') genderA = 'female';
    botAVoice = findVoice(genderA);

    // Bot B
    let genderB = voiceGenderB;
    if (genderB === 'auto') genderB = 'male';

    // Ensure distinct if possible
    botBVoice = findVoice(genderB);

    // If we have voices for this language, try to make them distinct
    if (botBVoice && botAVoice && botBVoice === botAVoice && voices.length > 1) {
        // Re-get the list to find a diff one
        const langCode = currentLanguage.split('-')[0];
        let langVoices = voices.filter(v => v.lang.startsWith(langCode));
        if (langVoices.length === 0 && LANG_NAMES[currentLanguage]) {
            langVoices = voices.filter(v => v.name.includes(LANG_NAMES[currentLanguage]));
        }

        if (langVoices.length > 1) {
            botBVoice = langVoices.find(v => v !== botAVoice) || botAVoice;
        }
    }
}

(async () => {
    await loadEnv();
    updateSettingsUI();

    // Apply Theme
    document.documentElement.setAttribute('data-theme', currentTheme);
    if (themeBtn) themeBtn.innerText = currentTheme === 'dark' ? '☀️' : '🌙';

    // Voice loading often requires a wait
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = initVoices;
    }
    initVoices();
})();

// --- Event Listeners ---
if (startBtn) startBtn.addEventListener('click', startDebate);
if (resumeBtn) resumeBtn.addEventListener('click', resumeDebate);
if (stopBtn) stopBtn.addEventListener('click', stopDebate);

if (muteBtn) {
    muteBtn.addEventListener('click', () => {
        isMuted = !isMuted;
        muteBtn.innerText = isMuted ? '🔇' : '🔊';
        if (isMuted) {
            synth.cancel();
        }
    });
}

if (themeBtn) {
    themeBtn.addEventListener('click', () => {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', currentTheme);
        localStorage.setItem('theme', currentTheme);
        themeBtn.innerText = currentTheme === 'dark' ? '☀️' : '🌙';
    });
}

if (speedSlider) {
    speedSlider.addEventListener('input', (e) => {
        speedValue.innerText = `${e.target.value}s`;
    });
}

if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
        updateSettingsUI();
        if (settingsModal) settingsModal.classList.remove('hidden');
    });
}

if (providerSelect) {
    providerSelect.addEventListener('change', (e) => {
        currentProvider = e.target.value;
        updateSettingsUI();
    });
}

if (modelSelect) {
    modelSelect.addEventListener('change', (e) => {
        currentModel = e.target.value;
    });
}

if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
        if (apiKeyInput && apiKeyInput.value && !apiKeyInput.value.startsWith('Loaded')) {
            const newOpenAIKey = apiKeyInput.value.trim();
            if (newOpenAIKey) {
                apiKeys.openai = newOpenAIKey;
                localStorage.setItem('openai_api_key', newOpenAIKey);
            }
        }

        if (geminiKeyInput && geminiKeyInput.value && !geminiKeyInput.value.startsWith('Loaded')) {
            const newGeminiKey = geminiKeyInput.value.trim();
            if (newGeminiKey) {
                apiKeys.gemini = newGeminiKey;
                localStorage.setItem('gemini_api_key', newGeminiKey);
            }
        }

        if (maxTurnsInput) {
            const val = parseInt(maxTurnsInput.value, 10);
            if (val && val >= 2) {
                maxTurnCount = val;
                localStorage.setItem('max_turns', val);
            }
        }

        if (personaASelect) {
            currentPersonaA = personaASelect.value;
            localStorage.setItem('persona_a', currentPersonaA);
        }
        if (personaBSelect) {
            currentPersonaB = personaBSelect.value;
            localStorage.setItem('persona_b', currentPersonaB);
        }
        if (languageSelect) {
            currentLanguage = languageSelect.value;
            localStorage.setItem('language', currentLanguage);
        }
        if (voiceGenderASelect) {
            voiceGenderA = voiceGenderASelect.value;
            localStorage.setItem('voice_gender_a', voiceGenderA);
        }
        if (voiceGenderBSelect) {
            voiceGenderB = voiceGenderBSelect.value;
            localStorage.setItem('voice_gender_b', voiceGenderB);
        }

        initVoices(); // Re-init voices based on new language/gender settings

        localStorage.setItem('selected_provider', currentProvider);
        localStorage.setItem('selected_model', currentModel);
        if (settingsModal) settingsModal.classList.add('hidden');
    });
}

// --- Core Logic ---

async function startDebate() {
    const topic = topicInput.value.trim();
    if (!topic) {
        alert('Please enter a topic.');
        return;
    }

    const activeKey = apiKeys[currentProvider];
    // Check key depending on provider
    if (!activeKey) {
        alert(`Please configure your ${currentProvider === 'openai' ? 'OpenAI' : 'Gemini'} API Key in Settings.`);
        if (settingsModal) settingsModal.classList.remove('hidden');
        return;
    }

    // Reset State
    isRunning = true;
    conversationHistory = [];
    turnCount = 0;
    currentTopic = topic;
    if (timeoutId) clearTimeout(timeoutId);

    // Init voices again just in case
    if (voices.length === 0) initVoices();

    chatContainer.innerHTML = '';

    // UI Updates
    startBtn.classList.add('hidden');
    resumeBtn.classList.add('hidden');
    stopBtn.disabled = false;
    topicInput.disabled = true;

    appendMessage('User', `Topic: ${topic}`, 'system');

    await runTurn(topic);
}

function resumeDebate() {
    if (!currentTopic) return;

    isRunning = true;
    startBtn.classList.add('hidden');
    resumeBtn.classList.add('hidden');
    stopBtn.disabled = false;
    topicInput.disabled = true;

    appendMessage('System', 'Resuming debate...', 'system');
    runTurn(currentTopic);
}

function stopDebate() {
    isRunning = false;
    if (timeoutId) clearTimeout(timeoutId);

    // UI Updates
    startBtn.classList.remove('hidden');
    startBtn.innerText = 'Start New';
    resumeBtn.classList.remove('hidden');
    resumeBtn.disabled = false;

    stopBtn.disabled = true;
    // topicInput.disabled = false; // Keep disabled so they don't change topic mid-stream easily without reset

    synth.cancel(); // Stop speaking
    appendMessage('System', 'Debate paused.', 'system');
}

function speak(text, botName) {
    return new Promise((resolve) => {
        if (isMuted) {
            resolve();
            return;
        }
        if (synth.speaking) synth.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = currentLanguage; // Explicitly set language for fallback

        // Assign voice only if we found a valid one for this language
        let selectedVoice = null;
        if (botName.includes('(Bot A)') || botName === PERSONAS[currentPersonaA].name) {
            selectedVoice = botAVoice;
            utterance.pitch = 1.1;
            utterance.rate = 1.0;
        } else {
            selectedVoice = botBVoice;
            utterance.pitch = 0.9;
            utterance.rate = 0.95;
        }

        if (selectedVoice) {
            utterance.voice = selectedVoice;
        } else {
            console.warn(`No specific voice found for ${currentLanguage}, relying on browser default.`);
        }

        utterance.onend = () => {
            resolve();
        };

        utterance.onerror = (e) => {
            console.error('Speech error:', e);
            resolve(); // Resolve anyway to keep loop going
        };

        synth.speak(utterance);
    });
}

async function runTurn(topic) {
    if (!isRunning) return;

    if (turnCount >= maxTurnCount) {
        appendMessage('System', 'Max turns reached. Debate finished.', 'system');
        stopDebate();
        // Hide resume generic cleanup
        resumeBtn.classList.add('hidden');
        topicInput.disabled = false;
        return;
    }

    const isBotA = turnCount % 2 === 0;

    // Resolve dynamic names and prompts
    const personaKey = isBotA ? currentPersonaA : currentPersonaB;
    const personaData = PERSONAS[personaKey];
    const currentBotName = personaData.name;
    let systemPrompt = personaData.system;

    // Append Language Directive
    const languageName = document.getElementById('language-select')?.options[document.getElementById('language-select')?.selectedIndex]?.text || currentLanguage;
    systemPrompt += ` IMPORTANT: Reply in ${languageName}.`;

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `The topic is: "${topic}". Conversation so far:` }
    ];

    conversationHistory.forEach(msg => {
        if (msg.name === currentBotName) {
            messages.push({ role: 'assistant', content: msg.content });
        } else {
            messages.push({ role: 'user', content: `${msg.name} said: ${msg.content}` });
        }
    });

    // Add a cue for the bot
    messages.push({ role: 'user', content: "Your response:" });

    try {
        const thinkingId = appendMessage(currentBotName, 'Thinking...', isBotA ? 'bot-a' : 'bot-b', true);

        let responseContent = '';
        const activeKey = apiKeys[currentProvider];

        if (currentProvider === 'openai') {
            responseContent = await callOpenAI(messages, activeKey, currentModel);
        } else if (currentProvider === 'gemini') {
            responseContent = await callGemini(messages, activeKey, currentModel);
        }

        const thinkingEl = document.getElementById(thinkingId);
        if (thinkingEl) thinkingEl.remove();

        if (!isRunning) return;

        appendMessage(currentBotName, responseContent, isBotA ? 'bot-a' : 'bot-b');

        // Speak!
        await speak(responseContent, currentBotName);

        conversationHistory.push({
            name: currentBotName,
            content: responseContent
        });

        turnCount++;

        const waitTimeSeconds = parseInt(speedSlider.value, 10) || 5;

        if (isRunning) {
            timeoutId = setTimeout(() => runTurn(topic), waitTimeSeconds * 1000);
        }

    } catch (error) {
        console.error(error);
        if (isRunning) {
            appendMessage('System', `Error (${currentProvider}): ${error.message}`, 'system');
            stopDebate();
        }
    }
}

function appendMessage(sender, text, className, isTemporary = false) {
    const msgDiv = document.createElement('div');
    const id = 'msg-' + Date.now() + Math.random();
    msgDiv.id = id;
    msgDiv.classList.add('message');
    if (className) msgDiv.classList.add(className);

    const senderSpan = document.createElement('span');
    senderSpan.classList.add('sender-name');
    senderSpan.innerText = sender;

    const contentDiv = document.createElement('div');
    contentDiv.innerText = text;

    msgDiv.appendChild(senderSpan);
    msgDiv.appendChild(contentDiv);

    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    return id;
}
