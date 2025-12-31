/**
 * Wrapper for OpenAI and Gemini APIs
 */

export async function callOpenAI(messages, apiKey, model = 'gpt-3.5-turbo') {
    const API_URL = 'https://api.openai.com/v1/chat/completions';
    if (!apiKey) {
        throw new Error('API Key is missing');
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Unknown OpenAI API Error');
        }

        const data = await response.json();
        return data.choices[0].message.content;

    } catch (error) {
        console.error('OpenAI API Call Failed:', error);
        throw error;
    }
}

export async function callGemini(messages, apiKey, model = 'gemini-2.5-flash-lite') {
    // Model: gemini-2.5-flash-preview-09-2025 is good for this
    // Model: gemini-2.5-flash-lite
    // Model: gemma-3-27b-it

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    if (!apiKey) {
        throw new Error('Gemini API Key is missing');
    }

    // Convert standard "messages" format to Gemini "contents" format
    // OpenAI: { role: 'system'|'user'|'assistant', content: '...' }
    // Gemini: { role: 'user'|'model', parts: [{ text: '...' }] }
    // Note: Gemini REST API doesn't support 'system' role directly in 'contents' in the same way (it used to be separate system_instruction)
    // But for simple chat, we can merge system prompt into the first user message or use system_instruction if available.
    // Let's use system_instruction for the persona.

    // Extract system message
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const contents = conversationMessages.map(msg => {
        return {
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        };
    });

    const payload = {
        contents: contents,
        generationConfig: {
            temperature: 0.7
        }
    };

    const isGemma = model.includes('gemma');

    if (systemMessage) {
        if (isGemma) {
            // Gemma models (via API) often don't support 'system_instruction' yet or strictly.
            // We merge the system prompt into the first user message.
            if (contents.length > 0 && contents[0].role === 'user') {
                contents[0].parts[0].text = `System Instruction: ${systemMessage.content}\n\n${contents[0].parts[0].text}`;
            } else {
                // If the first message isn't user (rare), or empty, just prepend a user message
                contents.unshift({
                    role: 'user',
                    parts: [{ text: `System Instruction: ${systemMessage.content}` }]
                });
            }
        } else {
            // Standard Gemini models support system_instruction
            payload.system_instruction = {
                parts: [{ text: systemMessage.content }]
            };
        }
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Unknown Gemini API Error');
        }

        const data = await response.json();

        // Safety check for empty responses
        if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
            return data.candidates[0].content.parts[0].text;
        } else {
            throw new Error('Gemini returned an empty response.');
        }

    } catch (error) {
        console.error('Gemini API Call Failed:', error);
        throw error;
    }
}

export async function callGroq(messages, apiKey, model = 'llama-3.3-70b-versatile') {
    const API_URL = 'https://api.groq.com/openai/v1/chat/completions';

    if (!apiKey) {
        throw new Error('Groq API Key is missing');
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Unknown Groq API Error');
        }

        const data = await response.json();
        return data.choices[0].message.content;

    } catch (error) {
        console.error('Groq API Call Failed:', error);
        throw error;
    }
}
