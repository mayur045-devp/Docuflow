import crypto from 'node:crypto';
import { getEnv } from '../env.js';
import {
	validateStrapiBaseUrl,
	strapiNetworkFetch,
	StrapiDestinationError
} from './destination.js';

/**
 * Normalizes any valid Strapi base URL safely.
 * - Trims whitespace
 * - Removes trailing slashes
 * - Preserves protocol (https:// or http://)
 * - Preserves subpaths if deployed under a path (e.g. https://domain.com/strapi)
 * - Deduplicates accidental multiple slashes in path
 *
 * @param {string} rawUrl
 * @returns {string}
 */
export function normalizeStrapiUrl(rawUrl) {
	if (!rawUrl || typeof rawUrl !== 'string') return '';
	let trimmed = rawUrl.trim();

	// Strip trailing slashes
	trimmed = trimmed.replace(/\/+$/, '');

	try {
		const parsed = new URL(trimmed);
		// Clean up path: deduplicate multiple slashes but keep subpath
		let cleanPath = parsed.pathname.replace(/\/+/g, '/').replace(/\/+$/, '');
		return `${parsed.protocol}//${parsed.host}${cleanPath}`;
	} catch {
		// Fallback regex cleanup if URL constructor fails
		return trimmed.replace(/\/+$/, '');
	}
}

/**
 * Safely constructs an absolute Strapi endpoint URL without double slashes or duplicated /api prefixes.
 *
 * @param {string} baseUrl
 * @param {string} pathAndQuery
 * @returns {string}
 */
export function buildStrapiEndpointUrl(baseUrl, pathAndQuery) {
	const normalizedBase = normalizeStrapiUrl(baseUrl);
	let cleanPath = (pathAndQuery || '').trim();

	if (!cleanPath.startsWith('/')) {
		cleanPath = '/' + cleanPath;
	}

	// Avoid duplicate /api if baseUrl already ends with /api and cleanPath starts with /api/
	if (normalizedBase.endsWith('/api') && cleanPath.startsWith('/api/')) {
		cleanPath = cleanPath.slice(4);
	}

	return `${normalizedBase}${cleanPath}`;
}

/**
 * Computes a safe fingerprint for a connection pair (URL + Token) without exposing the token.
 * @param {string} url
 * @param {string} token
 * @returns {string}
 */
export function getConnectionKey(url, token = '') {
	const normUrl = normalizeStrapiUrl(url);
	const tokenHash = token
		? crypto.createHash('sha256').update(token).digest('hex').slice(0, 16)
		: 'no-token';
	return `${normUrl}::${tokenHash}`;
}

// Active dynamic connection state
let dynamicConnection = null;

// Listeners for connection changes (to clear caches)
const changeListeners = new Set();

/**
 * Registers a listener that fires whenever the active connection changes.
 * @param {() => void} listener
 */
export function onConnectionChange(listener) {
	changeListeners.add(listener);
	return () => changeListeners.delete(listener);
}

function notifyConnectionChange() {
	for (const listener of changeListeners) {
		try {
			listener();
		} catch (e) {
			console.error('[Strapi Connection] Change listener error:', e);
		}
	}
}

/**
 * Returns the currently active Strapi connection (dynamic override or .env default).
 * Always treats the URL and Token as an atomic pair.
 *
 * @returns {{ strapiUrl: string, apiToken: string, version: string, isDefault: boolean }}
 */
export function getActiveConnection() {
	if (dynamicConnection) {
		return { ...dynamicConnection, isDefault: false };
	}

	const env = getEnv();
	const strapiUrl = normalizeStrapiUrl(env.STRAPI_URL);
	const apiToken = env.STRAPI_API_TOKEN || '';
	const version = env.STRAPI_VERSION || 'auto';

	return {
		strapiUrl,
		apiToken,
		version,
		isDefault: true
	};
}

/**
 * Validates the destination and binds saved credentials to the active base URL.
 *
 * @param {{ strapiUrl?: string, apiToken?: string }} conn
 */
export function resolveStrapiConnection({ strapiUrl, apiToken = undefined }) {
	const active = getActiveConnection();
	const normalizedUrl = validateStrapiBaseUrl(strapiUrl || active.strapiUrl);
	if (apiToken !== undefined && typeof apiToken !== 'string') {
		throw new StrapiDestinationError('The API token must be a string.', 'INVALID_API_TOKEN');
	}
	if (normalizedUrl !== active.strapiUrl && !apiToken?.trim()) {
		throw new StrapiDestinationError(
			'Enter the API token for the new Strapi environment.',
			'STRAPI_TOKEN_REQUIRED'
		);
	}
	return {
		strapiUrl: normalizedUrl,
		apiToken: apiToken === undefined ? active.apiToken : apiToken
	};
}

/** Returns the admin base URL belonging to the active CMS environment. */
export function getActiveStrapiAdminUrl() {
	const conn = getActiveConnection();
	const env = getEnv();
	const base = normalizeStrapiUrl(conn.strapiUrl);
	if (base === normalizeStrapiUrl(env.STRAPI_URL) && env.STRAPI_ADMIN_URL) {
		return normalizeStrapiUrl(env.STRAPI_ADMIN_URL);
	}
	return `${base}/admin`;
}

/** @param {{ strapiUrl: string, apiToken?: string, version?: string }} conn */
export function setActiveConnection(conn) {
	const { strapiUrl: normalizedUrl, apiToken } = resolveStrapiConnection(conn);
	const version = conn.version || 'auto';

	const previousKey = dynamicConnection
		? getConnectionKey(dynamicConnection.strapiUrl, dynamicConnection.apiToken)
		: getConnectionKey(getEnv().STRAPI_URL, getEnv().STRAPI_API_TOKEN);

	const newKey = getConnectionKey(normalizedUrl, apiToken);

	dynamicConnection = {
		strapiUrl: normalizedUrl,
		apiToken,
		version
	};

	if (previousKey !== newKey) {
		try {
			const host = new URL(normalizedUrl).host;
			console.log(`[Strapi Connection] Active connection switched to: ${host}`);
		} catch {
			console.log(`[Strapi Connection] Active connection updated: ${normalizedUrl}`);
		}
		notifyConnectionChange();
	}

	return { ...dynamicConnection, isDefault: false };
}

/**
 * Resets the active connection back to the .env configuration defaults and invalidates caches.
 */
export function resetActiveConnection() {
	dynamicConnection = null;
	notifyConnectionChange();
	return getActiveConnection();
}

/**
 * Tests a Strapi connection against a specific URL and token, returning a comprehensive diagnostic response.
 *
 * @param {object} [options]
 * @param {string} [options.strapiUrl]
 * @param {string} [options.apiToken]
 * @param {number} [options.timeoutMs=8000]
 * @returns {Promise<{
 *   success: boolean,
 *   baseUrl: string,
 *   normalizedUrl: string,
 *   status: number | null,
 *   authenticated: boolean,
 *   apiReachable: boolean,
 *   schemaDiscoveryAvailable: boolean,
 *   contentTypesCount?: number,
 *   componentsCount?: number,
 *   version?: string,
 *   errorCode: string | null,
 *   message: string,
 *   durationMs: number
 * }>}
 */
export async function testStrapiConnection({
	strapiUrl: inputUrl,
	apiToken: inputToken,
	timeoutMs = 8000
} = {}) {
	const startTime = Date.now();
	let conn;
	try {
		conn = resolveStrapiConnection({ strapiUrl: inputUrl, apiToken: inputToken });
	} catch (err) {
		if (!(err instanceof StrapiDestinationError)) throw err;
		return {
			success: false,
			baseUrl: '',
			normalizedUrl: '',
			status: 400,
			authenticated: false,
			apiReachable: false,
			schemaDiscoveryAvailable: false,
			errorCode: err.code,
			message: err.message,
			durationMs: Date.now() - startTime
		};
	}
	const { strapiUrl: normalizedUrl, apiToken: token } = conn;
	const rawBaseUrl = normalizedUrl;

	const host = new URL(normalizedUrl).host;

	console.log(`[Strapi Connection] Testing connection to Host: ${host}`);

	// Probe the API directly; redirects are rejected by the network boundary.
	const ctbUrl = buildStrapiEndpointUrl(normalizedUrl, '/api/content-type-builder/content-types');
	const headers = new Headers();
	if (token) {
		headers.set('Authorization', `Bearer ${token}`);
	}

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const res = await strapiNetworkFetch(
			ctbUrl,
			{
				headers,
				signal: controller.signal
			},
			normalizedUrl
		);

		clearTimeout(timeoutId);
		const duration = Date.now() - startTime;

		console.log(`[Strapi Connection]`);
		console.log(`Host: ${host}`);
		console.log(`Endpoint: /api/content-type-builder/content-types`);
		console.log(`Status: ${res.status}`);
		console.log(`Duration: ${duration}ms`);

		// HTTP 200 OK: Full schema discovery & API access verified
		if (res.ok) {
			let contentTypesCount = 0;
			let componentsCount = 0;
			try {
				const ctbJson = await res.json();
				contentTypesCount = ctbJson.data?.length || 0;

				// Also check components
				const compUrl = buildStrapiEndpointUrl(
					normalizedUrl,
					'/api/content-type-builder/components'
				);
				const compRes = await strapiNetworkFetch(compUrl, { headers }, normalizedUrl);
				if (compRes.ok) {
					const compJson = await compRes.json();
					componentsCount = compJson.data?.length || 0;
				}
			} catch {
				// ignore JSON parse
			}

			return {
				success: true,
				baseUrl: rawBaseUrl,
				normalizedUrl,
				status: res.status,
				authenticated: true,
				apiReachable: true,
				schemaDiscoveryAvailable: true,
				contentTypesCount,
				componentsCount,
				version: '5',
				errorCode: null,
				message: 'Strapi connection successful',
				durationMs: duration
			};
		}

		// Handle specific HTTP error status codes (Requirement 3)
		if (res.status === 401) {
			return {
				success: false,
				baseUrl: rawBaseUrl,
				normalizedUrl,
				status: 401,
				authenticated: false,
				apiReachable: true,
				schemaDiscoveryAvailable: false,
				errorCode: 'INVALID_API_TOKEN',
				message: 'Strapi server is reachable, but the API token was rejected.',
				durationMs: duration
			};
		}

		if (res.status === 403) {
			return {
				success: false,
				baseUrl: rawBaseUrl,
				normalizedUrl,
				status: 403,
				authenticated: true,
				apiReachable: true,
				schemaDiscoveryAvailable: false,
				errorCode: 'FORBIDDEN',
				message:
					'Strapi server is reachable and the token is valid, but the token does not have permission for this operation.',
				durationMs: duration
			};
		}

		if (res.status === 404) {
			return {
				success: false,
				baseUrl: rawBaseUrl,
				normalizedUrl,
				status: 404,
				authenticated: false,
				apiReachable: true,
				schemaDiscoveryAvailable: false,
				errorCode: 'ENDPOINT_NOT_FOUND',
				message:
					'The Strapi URL is reachable, but the requested API endpoint was not found. Check the Strapi base URL/API prefix.',
				durationMs: duration
			};
		}

		if (res.status === 400) {
			return {
				success: false,
				baseUrl: rawBaseUrl,
				normalizedUrl,
				status: 400,
				authenticated: false,
				apiReachable: true,
				schemaDiscoveryAvailable: false,
				errorCode: 'BAD_REQUEST',
				message:
					'Strapi server rejected the request as a Bad Request (400). Please check URL formatting and parameters.',
				durationMs: duration
			};
		}

		if (res.status === 405) {
			return {
				success: false,
				baseUrl: rawBaseUrl,
				normalizedUrl,
				status: 405,
				authenticated: false,
				apiReachable: true,
				schemaDiscoveryAvailable: false,
				errorCode: 'METHOD_NOT_ALLOWED',
				message: 'The Strapi endpoint does not allow the requested HTTP method.',
				durationMs: duration
			};
		}

		if (res.status === 429) {
			return {
				success: false,
				baseUrl: rawBaseUrl,
				normalizedUrl,
				status: 429,
				authenticated: false,
				apiReachable: true,
				schemaDiscoveryAvailable: false,
				errorCode: 'RATE_LIMITED',
				message: 'Strapi server rate limit reached. Please wait before retrying.',
				durationMs: duration
			};
		}

		if (res.status >= 502 && res.status <= 504) {
			return {
				success: false,
				baseUrl: rawBaseUrl,
				normalizedUrl,
				status: res.status,
				authenticated: false,
				apiReachable: false,
				schemaDiscoveryAvailable: false,
				errorCode: 'UPSTREAM_UNAVAILABLE',
				message:
					'The Strapi domain is reachable, but the upstream Strapi server/proxy is unavailable.',
				durationMs: duration
			};
		}

		return {
			success: false,
			baseUrl: rawBaseUrl,
			normalizedUrl,
			status: res.status,
			authenticated: false,
			apiReachable: true,
			schemaDiscoveryAvailable: false,
			errorCode: `HTTP_${res.status}`,
			message: `Strapi server returned HTTP status ${res.status} (${res.statusText || 'Error'}).`,
			durationMs: duration
		};
	} catch (err) {
		clearTimeout(timeoutId);
		const duration = Date.now() - startTime;
		if (err instanceof StrapiDestinationError) {
			return {
				success: false,
				baseUrl: rawBaseUrl,
				normalizedUrl,
				status: 400,
				authenticated: false,
				apiReachable: false,
				schemaDiscoveryAvailable: false,
				errorCode: err.code,
				message: err.message,
				durationMs: duration
			};
		}
		const errStr = err instanceof Error ? err.message : String(err);

		console.log(`[Strapi Connection]`);
		console.log(`Host: ${host}`);
		console.log(`Endpoint: /api/content-type-builder/content-types`);
		console.log(`Status: Network Failure`);
		console.log(`Duration: ${duration}ms`);
		console.log(`Error: ${errStr}`);

		if (errStr.includes('abort') || errStr.includes('timeout')) {
			return {
				success: false,
				baseUrl: rawBaseUrl,
				normalizedUrl,
				status: null,
				authenticated: false,
				apiReachable: false,
				schemaDiscoveryAvailable: false,
				errorCode: 'TIMEOUT',
				message: `Connection to the Strapi server timed out after ${timeoutMs}ms.`,
				durationMs: duration
			};
		}

		if (
			errStr.includes('CERT_') ||
			errStr.includes('UNABLE_TO_VERIFY') ||
			errStr.includes('self-signed') ||
			errStr.includes('SSL') ||
			errStr.includes('TLS')
		) {
			return {
				success: false,
				baseUrl: rawBaseUrl,
				normalizedUrl,
				status: null,
				authenticated: false,
				apiReachable: false,
				schemaDiscoveryAvailable: false,
				errorCode: 'TLS_ERROR',
				message:
					'A TLS/SSL security certificate error occurred while connecting to the Strapi server.',
				durationMs: duration
			};
		}

		return {
			success: false,
			baseUrl: rawBaseUrl,
			normalizedUrl,
			status: null,
			authenticated: false,
			apiReachable: false,
			schemaDiscoveryAvailable: false,
			errorCode: 'NETWORK_ERROR',
			message: 'The application could not establish a connection to the supplied Strapi URL.',
			durationMs: duration
		};
	}
}
