import { getEnv } from '../env.js';
import { geminiProvider } from './gemini.js';
import { mockProvider } from './mock.js';
import { buildExtractionPrompt } from './prompt.js';
import { contentTypeToJsonSchema } from '../schema/to-json-schema.js';
import { validateContentData } from '../schema/to-zod.js';
import { extractHeuristics } from './fallback-heuristic.js';

/**
 * Executes the full AI extraction pipeline with retry on validation error and graceful fallback.
 *
 * @param {object} params
 * @param {import('../document/model.js').DocumentModel} params.documentModel
 * @param {any} params.contentTypeDef
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<{
 *   data: any,
 *   fieldNotes: any[],
 *   warnings: string[],
 *   unmapped: any[],
 *   issues: any[],
 *   latencyMs: number,
 *   tokensUsed: number,
 *   providerUsed: string
 * }>}
 */
export async function runExtraction({ documentModel, contentTypeDef, signal }) {
	const env = getEnv();
	const startTime = Date.now();

	const jsonSchema = contentTypeToJsonSchema(contentTypeDef, true);
	let prompt = buildExtractionPrompt({
		contentTypeDef,
		markdown: documentModel.markdown,
		hints: documentModel.hints
	});

	let provider = env.AI_PROVIDER === 'gemini' ? geminiProvider : mockProvider;
	let providerName = /** @type {string} */ (env.AI_PROVIDER);

	if (provider === mockProvider) {
		mockProvider.setDocumentContext(documentModel, contentTypeDef);
	}

	let lastResult = null;
	let attempts = 0;
	const maxRetries = env.AI_MAX_RETRIES || 2;
	let totalTokens = 0;

	while (attempts <= maxRetries) {
		attempts += 1;
		try {
			const res = await provider.generateStructured({
				prompt,
				jsonSchema,
				signal,
				model: env.GEMINI_MODEL
			});

			totalTokens += res.tokensUsed || 0;
			const envelope = res.data?.data ? res.data : { data: res.data || {} };
			const extractedData = envelope.data || {};

			// Zod validate extracted content data
			const validation = validateContentData(contentTypeDef, extractedData);

			if (validation.valid || attempts > maxRetries) {
				lastResult = {
					data: extractedData,
					fieldNotes: envelope.fieldNotes || [],
					warnings: envelope.warnings || [],
					unmapped: envelope.unmapped || [],
					issues: validation.issues
				};
				break;
			}

			// Feedback validation errors to prompt for retry
			const errorLines = validation.issues.map((i) => `- ${i.path}: ${i.message}`).join('\n');
			prompt += `\n\n[RETRY NOTICE]: Your previous output failed schema validation with these errors:\n${errorLines}\nPlease correct these fields in your updated output.`;
		} catch (err) {
			console.warn(
				`[DocuFlow AI] Extraction attempt ${attempts} failed:`,
				err instanceof Error ? err.message : err
			);

			// On final retry failure, fallback to heuristics
			if (attempts > maxRetries) {
				console.log('[DocuFlow AI] Falling back to heuristic extraction engine.');
				const fallback = extractHeuristics({ documentModel, contentTypeDef });
				const validation = validateContentData(contentTypeDef, fallback.data);
				lastResult = {
					...fallback,
					warnings: [
						'AI service was unavailable; automatic heuristic fallback was used.',
						...fallback.warnings
					],
					issues: validation.issues
				};
				providerName = 'fallback-heuristic';
				break;
			}
		}
	}

	if (!lastResult) {
		const fallback = extractHeuristics({ documentModel, contentTypeDef });
		const validation = validateContentData(contentTypeDef, fallback.data);
		lastResult = {
			...fallback,
			warnings: ['AI extraction failed; heuristic fallback applied.', ...fallback.warnings],
			issues: validation.issues
		};
		providerName = 'fallback-heuristic';
	}

	// Schema whitelist: drop any top-level properties not present in attributes
	const whitelistedData = {};
	const attributes = contentTypeDef?.attributes || {};
	for (const [key, val] of Object.entries(lastResult.data || {})) {
		if (attributes[key]) {
			whitelistedData[key] = val;
		}
	}

	const latencyMs = Date.now() - startTime;
	console.log(
		`[DocuFlow AI] Completed in ${latencyMs}ms using ${providerName} (${totalTokens} tokens)`
	);

	return {
		data: whitelistedData,
		fieldNotes: lastResult.fieldNotes || [],
		warnings: lastResult.warnings || [],
		unmapped: lastResult.unmapped || [],
		issues: lastResult.issues || [],
		latencyMs,
		tokensUsed: totalTokens,
		providerUsed: providerName
	};
}
