import { getEnv } from '../env.js';
import { redact } from '../security/redact.js';
import { normalizeStrapiError } from './errors.js';

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_NETWORK_RETRIES = 2;

/**
 * Executes a resilient, authenticated request to Strapi.
 *
 * @param {string} pathAndQuery
 * @param {RequestInit & { timeoutMs?: number }} [options]
 * @returns {Promise<any>}
 */
export async function strapiFetch(pathAndQuery, options = {}) {
	const { STRAPI_URL, STRAPI_API_TOKEN } = getEnv();
	const url = `${STRAPI_URL}${pathAndQuery.startsWith('/') ? '' : '/'}${pathAndQuery}`;
	const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

	const headers = new Headers(options.headers || {});
	if (STRAPI_API_TOKEN && !headers.has('Authorization')) {
		headers.set('Authorization', `Bearer ${STRAPI_API_TOKEN}`);
	}

	let lastError = null;

	for (let attempt = 0; attempt <= MAX_NETWORK_RETRIES; attempt++) {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

		try {
			const res = await fetch(url, {
				...options,
				headers,
				signal: controller.signal
			});

			clearTimeout(timeoutId);

			if (res.ok) {
				// Handle 204 No Content
				if (res.status === 204) return null;
				return await res.json();
			}

			// Parse error body if available
			let errBody = null;
			try {
				errBody = await res.json();
			} catch {
				errBody = { message: res.statusText };
			}

			// Do NOT retry client errors (400, 401, 403, 404, 422) except rate-limit 429
			if (res.status !== 429 && res.status < 500) {
				const normalized = normalizeStrapiError(errBody, res.status);
				const err = new Error(normalized.message);
				// @ts-ignore
				err.status = res.status;
				// @ts-ignore
				err.details = normalized;
				throw err;
			}

			// If 429 or 5xx, retry with exponential backoff if attempts remain
			if (attempt < MAX_NETWORK_RETRIES) {
				const backoffMs = Math.pow(2, attempt) * 500;
				await new Promise((r) => setTimeout(r, backoffMs));
				continue;
			}

			const normalized = normalizeStrapiError(errBody, res.status);
			const err = new Error(normalized.message);
			// @ts-ignore
			err.status = res.status;
			// @ts-ignore
			err.details = normalized;
			throw err;
		} catch (err) {
			clearTimeout(timeoutId);

			// @ts-ignore
			if (err?.status && err.status < 500 && err.status !== 429) {
				throw err; // don't retry 4xx
			}

			lastError = err;

			if (attempt < MAX_NETWORK_RETRIES) {
				const backoffMs = Math.pow(2, attempt) * 500;
				await new Promise((r) => setTimeout(r, backoffMs));
			}
		}
	}

	const safeMessage = redact(lastError instanceof Error ? lastError.message : String(lastError));
	let descriptiveMessage = `Strapi request failed after retries: ${safeMessage}`;

	// Provide actionable guidance on network / connection refusal
	if (
		safeMessage.includes('fetch failed') ||
		safeMessage.includes('ECONNREFUSED') ||
		safeMessage.includes('ENOTFOUND')
	) {
		descriptiveMessage = `Cannot connect to Strapi at ${getEnv().STRAPI_URL} (${safeMessage}). Please verify Strapi is running (run 'npm run mock:strapi' if using the mock server) and that STRAPI_URL in .env is correct.`;
	}

	const errorToThrow = new Error(descriptiveMessage);
	// @ts-ignore
	errorToThrow.status = 502;
	// @ts-ignore
	errorToThrow.isConnectionError = true;
	throw errorToThrow;
}
