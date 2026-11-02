import { GoogleGenAI } from '@google/genai';
import { getEnv } from '../env.js';
import { redact } from '../security/redact.js';

/**
 * Gemini AI Provider implementation using the official @google/genai SDK.
 * @type {import('./provider.js').AIProvider}
 */
export const geminiProvider = {
	async generateStructured({ prompt, jsonSchema, signal: _signal, model }) {
		const env = getEnv();
		if (!env.GEMINI_API_KEY) {
			throw new Error('GEMINI_API_KEY is not configured. Please add it to your .env file.');
		}

		const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
		const chosenModel = model || env.GEMINI_MODEL || 'gemini-2.5-flash';

		try {
			const response = await ai.models.generateContent({
				model: chosenModel,
				contents: prompt,
				config: {
					responseMimeType: 'application/json',
					responseSchema: jsonSchema
				}
			});

			const text = response.text || '';
			let data = {};
			try {
				data = JSON.parse(text);
			} catch {
				throw new Error('Gemini returned an invalid JSON response.');
			}

			const tokensUsed = response.usageMetadata?.totalTokenCount || 0;
			return {
				text,
				data,
				tokensUsed
			};
		} catch (err) {
			const safeMessage = redact(err instanceof Error ? err.message : String(err));

			if (/quota|resource_exhausted|429/i.test(safeMessage)) {
				throw new Error(
					'Gemini API quota exceeded or rate limit reached. Please try again shortly.'
				);
			}
			if (/safety|blocked/i.test(safeMessage)) {
				throw new Error('Document content was flagged by Gemini safety filters.');
			}
			if (/api_key_invalid|unauthenticated/i.test(safeMessage)) {
				throw new Error('Invalid Gemini API key. Please check your GEMINI_API_KEY setting.');
			}

			throw new Error(`Gemini AI extraction error: ${safeMessage}`);
		}
	}
};
