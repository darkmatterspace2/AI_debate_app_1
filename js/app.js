import { callOpenAI, callGemini } from './api.js';

// --- Configuration ---
let maxTurnCount = parseInt(localStorage.getItem('max_turns'), 10) || 10;
const BOT_A_NAME = 'Bot A (Optimist)';
const BOT_B_NAME = 'Bot B (Skeptic)';

const SYSTEM_PROMPT_A = `You are ${BOT_A_NAME}. You are an eternal optimist. You always see the bright side of things, even in controversial topics. Your tone is cheerful, encouraging, and slightly naive. Keep your responses short (under 50 words) and conversational.`;

const SYSTEM_PROMPT_B = `You are ${BOT_B_NAME}. You are a critical skeptic. You always find flaws, risks, or downsides. Your tone is analytical, dry, and perhaps a bit cynical. Keep your responses short (under 50 words) and conversational.`;

// --- State ---
let conversationHistory = [];
let isRunning = false;
let turnCount = 0;
let isMuted = false;
let currentTopic = '';
let timeoutId = null;
let currentTheme = localStorage.getItem('theme') || 'dark';

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
}

function initVoices() {
    voices = synth.getVoices();
    // Try to find distinct voices
    // Bot A (Optimist): Female or lighter voice
    botAVoice = voices.find(v => v.name.includes('Female') || v.name.includes('Google US English')) || voices[0];

    // Bot B (Skeptic): Male or deeper voice if possible, or just a different one
    botBVoice = voices.find(v => (v.name.includes('Male') || v.name.includes('Microsoft David')) && v !== botAVoice) || voices[1] || voices[0];
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
        if (botName === BOT_A_NAME && botAVoice) {
            utterance.voice = botAVoice;
            utterance.pitch = 1.1; // Slightly higher/optimistic
            utterance.rate = 1.0;
        } else if (botName === BOT_B_NAME && botBVoice) {
            utterance.voice = botBVoice;
            utterance.pitch = 0.9; // Slightly lower/skeptical
            utterance.rate = 0.95;
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
    const currentBotName = isBotA ? BOT_A_NAME : BOT_B_NAME;
    const systemPrompt = isBotA ? SYSTEM_PROMPT_A : SYSTEM_PROMPT_B;

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
