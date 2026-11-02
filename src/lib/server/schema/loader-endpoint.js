import { getEnv } from '../env.js';
import { normalizeContentType } from './normalize.js';

let cachedResult = null;
let cachedFingerprint = '';
let cacheExpiresAt = 0;

/**
 * Loads content types and components from Strapi's live schema endpoint.
 *
 * @param {object} [options]
 * @param {boolean} [options.forceRefresh=false]
 * @param {number} [options.timeoutMs=3000]
 * @returns {Promise<{ contentTypes: Record<string, any>, components: Record<string, any>, strapiVersion?: string } | null>}
 */
export async function loadSchemasFromLiveEndpoint({ forceRefresh = false, timeoutMs = 3000 } = {}) {
	const env = getEnv();
	const strapiUrl = env.STRAPI_URL || 'http://localhost:1337';
	const now = Date.now();

	if (!forceRefresh && cachedResult && now < cacheExpiresAt) {
		return cachedResult;
	}

	/** @type {Record<string, string>} */
	const headers = {};
	if (env.STRAPI_API_TOKEN) {
		headers['Authorization'] = `Bearer ${env.STRAPI_API_TOKEN}`;
	}

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const res = await fetch(`${strapiUrl}/api/docuflow-schemas`, {
			headers,
			signal: controller.signal
		});

		clearTimeout(timeoutId);

		if (!res.ok) {
			return null;
		}

		const body = await res.json();
		const rawContentTypes = body.data?.contentTypes || {};
		const rawComponents = body.data?.components || {};
		const strapiVersion = body.data?.version;

		const normalizedContentTypes = {};
		for (const [uid, raw] of Object.entries(rawContentTypes)) {
			normalizedContentTypes[uid] = normalizeContentType(raw, rawComponents);
		}

		const result = {
			contentTypes: normalizedContentTypes,
			components: rawComponents,
			strapiVersion
		};

		cachedResult = result;
		// Safe cache for 10 seconds if not forced
		cacheExpiresAt = now + 10 * 1000;

		return result;
	} catch {
		clearTimeout(timeoutId);
		return null;
	}
}
