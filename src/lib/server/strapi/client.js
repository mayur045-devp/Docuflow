import { getEnv } from '../env.js';
import { redact } from '../security/redact.js';
import { normalizeStrapiError } from './errors.js';
import { uploadMedia } from './media.js';

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
				let message;
				if (res.status === 401) {
					message = `Strapi authentication failed (401 Unauthorized). The configured API token may be invalid or expired. Please check STRAPI_API_TOKEN in .env. URL: ${STRAPI_URL}`;
				} else if (res.status === 403) {
					message = `Strapi permission denied (403 Forbidden). The configured API token lacks the required permissions for "${pathAndQuery}".`;
				} else if (res.status === 404) {
					message = `Strapi endpoint not found (404 Not Found): "${pathAndQuery}" at ${STRAPI_URL}.`;
				} else {
					const normalized = normalizeStrapiError(errBody, res.status);
					message = normalized.message;
				}

				const err = new Error(message);
				// @ts-ignore
				err.status = res.status;
				// @ts-ignore
				err.details = normalizeStrapiError(errBody, res.status);
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
		descriptiveMessage = `Cannot connect to Strapi at ${getEnv().STRAPI_URL} (${safeMessage}). Please verify network connectivity and that the Strapi server is online and reachable.`;
	}

	const errorToThrow = new Error(descriptiveMessage);
	// @ts-ignore
	errorToThrow.status = 502;
	// @ts-ignore
	errorToThrow.isConnectionError = true;
	throw errorToThrow;
}

/**
 * Centralized server-side Strapi client service.
 */
export const strapiClient = {
	/**
	 * Returns the configured Strapi Base URL.
	 */
	getUrl() {
		return getEnv().STRAPI_URL;
	},

	/**
	 * Performs a GET request to Strapi.
	 * @param {string} path
	 * @param {RequestInit & { timeoutMs?: number }} [options]
	 */
	async get(path, options = {}) {
		return strapiFetch(path, { ...options, method: 'GET' });
	},

	/**
	 * Performs a POST request to Strapi.
	 * @param {string} path
	 * @param {any} data
	 * @param {RequestInit & { timeoutMs?: number }} [options]
	 */
	async post(path, data, options = {}) {
		const headers = new Headers(options.headers || {});
		if (!headers.has('Content-Type')) {
			headers.set('Content-Type', 'application/json');
		}
		return strapiFetch(path, {
			...options,
			method: 'POST',
			headers,
			body: JSON.stringify(data)
		});
	},

	/**
	 * Performs a PUT request to Strapi.
	 * @param {string} path
	 * @param {any} data
	 * @param {RequestInit & { timeoutMs?: number }} [options]
	 */
	async put(path, data, options = {}) {
		const headers = new Headers(options.headers || {});
		if (!headers.has('Content-Type')) {
			headers.set('Content-Type', 'application/json');
		}
		return strapiFetch(path, {
			...options,
			method: 'PUT',
			headers,
			body: JSON.stringify(data)
		});
	},

	/**
	 * Performs a PATCH request to Strapi.
	 * @param {string} path
	 * @param {any} data
	 * @param {RequestInit & { timeoutMs?: number }} [options]
	 */
	async patch(path, data, options = {}) {
		const headers = new Headers(options.headers || {});
		if (!headers.has('Content-Type')) {
			headers.set('Content-Type', 'application/json');
		}
		return strapiFetch(path, {
			...options,
			method: 'PATCH',
			headers,
			body: JSON.stringify(data)
		});
	},

	/**
	 * Performs a DELETE request to Strapi.
	 * @param {string} path
	 * @param {RequestInit & { timeoutMs?: number }} [options]
	 */
	async delete(path, options = {}) {
		return strapiFetch(path, { ...options, method: 'DELETE' });
	},

	/**
	 * Uploads media to Strapi.
	 * @param {Buffer} buffer
	 * @param {object} info
	 * @param {string} info.filename
	 * @param {string} info.mimeType
	 * @param {string} [info.altText]
	 */
	async upload(buffer, info) {
		return uploadMedia(buffer, info);
	}
};
