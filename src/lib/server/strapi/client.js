import { redact } from '../security/redact.js';
import { normalizeStrapiError } from './errors.js';
import { uploadMedia } from './media.js';
import {
	getActiveConnection,
	buildStrapiEndpointUrl,
	normalizeStrapiUrl
} from './connection.js';

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_NETWORK_RETRIES = 2;

/**
 * Executes a resilient, authenticated request to Strapi.
 *
 * @param {string} pathAndQuery
 * @param {RequestInit & { timeoutMs?: number, connection?: { strapiUrl: string, apiToken?: string } }} [options]
 * @returns {Promise<any>}
 */
export async function strapiFetch(pathAndQuery, options = {}) {
	const conn = options.connection || getActiveConnection();
	const strapiUrl = normalizeStrapiUrl(conn.strapiUrl);
	const strapiToken = conn.apiToken || '';

	if (!strapiUrl) {
		throw new Error('STRAPI_URL is not configured. Please configure your Strapi CMS URL.');
	}

	const url = buildStrapiEndpointUrl(strapiUrl, pathAndQuery);
	const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

	let host = 'unknown';
	try {
		host = new URL(url).host;
	} catch {
		// ignore
	}

	const headers = new Headers(options.headers || {});
	if (strapiToken && !headers.has('Authorization')) {
		headers.set('Authorization', `Bearer ${strapiToken}`);
	}

	let lastError = null;
	const startTime = Date.now();

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
			const duration = Date.now() - startTime;

			// Server-side diagnostic log (Requirement 13)
			console.log(`[Strapi Connection]`);
			console.log(`Host: ${host}`);
			console.log(`Endpoint: ${pathAndQuery}`);
			console.log(`Status: ${res.status}`);
			console.log(`Duration: ${duration}ms`);

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

			// Do NOT retry client errors (400, 401, 403, 404, 405, 422) except rate-limit 429
			if (res.status !== 429 && res.status < 500) {
				let message;
				let errorCode = `HTTP_${res.status}`;

				if (res.status === 400) {
					errorCode = 'BAD_REQUEST';
					message = `Strapi server rejected the request as a Bad Request (400). Please check URL formatting and parameters. Endpoint: ${pathAndQuery}`;
				} else if (res.status === 401) {
					errorCode = 'INVALID_API_TOKEN';
					message = `Strapi server is reachable, but the API token was rejected. (401 Unauthorized for Host: ${host})`;
				} else if (res.status === 403) {
					errorCode = 'FORBIDDEN';
					message = `Strapi server is reachable and the token is valid, but the token does not have permission for this operation. Endpoint: "${pathAndQuery}"`;
				} else if (res.status === 404) {
					errorCode = 'ENDPOINT_NOT_FOUND';
					message = `The Strapi URL is reachable, but the requested API endpoint was not found (404 Not Found): "${pathAndQuery}" on Host: ${host}`;
				} else if (res.status === 405) {
					errorCode = 'METHOD_NOT_ALLOWED';
					message = `The Strapi endpoint does not allow the requested HTTP method: "${pathAndQuery}"`;
				} else {
					const normalized = normalizeStrapiError(errBody, res.status);
					message = normalized.message;
				}

				const err = new Error(message);
				// @ts-ignore
				err.status = res.status;
				// @ts-ignore
				err.errorCode = errorCode;
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

			let errorMsg = `Strapi server returned error ${res.status}`;
			if (res.status >= 502 && res.status <= 504) {
				errorMsg = `The Strapi domain is reachable, but the upstream Strapi server/proxy is unavailable (${res.status} on ${host}).`;
			} else {
				const normalized = normalizeStrapiError(errBody, res.status);
				errorMsg = normalized.message;
			}

			const err = new Error(errorMsg);
			// @ts-ignore
			err.status = res.status;
			// @ts-ignore
			err.errorCode = res.status >= 502 ? 'UPSTREAM_UNAVAILABLE' : `HTTP_${res.status}`;
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

	const duration = Date.now() - startTime;
	const safeMessage = redact(lastError instanceof Error ? lastError.message : String(lastError));

	console.log(`[Strapi Connection]`);
	console.log(`Host: ${host}`);
	console.log(`Endpoint: ${pathAndQuery}`);
	console.log(`Status: Failed after retries`);
	console.log(`Duration: ${duration}ms`);
	console.log(`Error: ${safeMessage}`);

	let descriptiveMessage = `Strapi request failed: ${safeMessage}`;
	let errorCode = 'NETWORK_ERROR';

	if (safeMessage.includes('abort') || safeMessage.includes('timeout')) {
		errorCode = 'TIMEOUT';
		descriptiveMessage = `Connection to the Strapi server at ${strapiUrl} timed out after ${timeoutMs}ms.`;
	} else if (
		safeMessage.includes('fetch failed') ||
		safeMessage.includes('ECONNREFUSED') ||
		safeMessage.includes('ENOTFOUND')
	) {
		errorCode = 'NETWORK_ERROR';
		descriptiveMessage = `The application could not establish a connection to the supplied Strapi URL at ${strapiUrl}.`;
	} else if (
		safeMessage.includes('CERT_') ||
		safeMessage.includes('UNABLE_TO_VERIFY') ||
		safeMessage.includes('self-signed') ||
		safeMessage.includes('SSL') ||
		safeMessage.includes('TLS')
	) {
		errorCode = 'TLS_ERROR';
		descriptiveMessage = `A TLS/SSL security certificate error occurred while connecting to ${strapiUrl}.`;
	}

	const errorToThrow = new Error(descriptiveMessage);
	// @ts-ignore
	errorToThrow.status = 502;
	// @ts-ignore
	errorToThrow.errorCode = errorCode;
	// @ts-ignore
	errorToThrow.isConnectionError = true;
	throw errorToThrow;
}

/**
 * Centralized server-side Strapi client service.
 */
export const strapiClient = {
	/**
	 * Returns the currently active Strapi Base URL.
	 */
	getUrl() {
		return getActiveConnection().strapiUrl;
	},

	/**
	 * Performs a GET request to Strapi.
	 * @param {string} path
	 * @param {RequestInit & { timeoutMs?: number, connection?: { strapiUrl: string, apiToken?: string } }} [options]
	 */
	async get(path, options = {}) {
		return strapiFetch(path, { ...options, method: 'GET' });
	},

	/**
	 * Performs a POST request to Strapi.
	 * @param {string} path
	 * @param {any} data
	 * @param {RequestInit & { timeoutMs?: number, connection?: { strapiUrl: string, apiToken?: string } }} [options]
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
	 * @param {RequestInit & { timeoutMs?: number, connection?: { strapiUrl: string, apiToken?: string } }} [options]
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
	 * @param {RequestInit & { timeoutMs?: number, connection?: { strapiUrl: string, apiToken?: string } }} [options]
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
	 * @param {RequestInit & { timeoutMs?: number, connection?: { strapiUrl: string, apiToken?: string } }} [options]
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
	 * @param {{ strapiUrl?: string, apiToken?: string }} [connection]
	 */
	async upload(buffer, info, connection) {
		return uploadMedia(buffer, info, connection);
	}
};
