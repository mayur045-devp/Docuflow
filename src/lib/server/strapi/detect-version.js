import { getEnv } from '../env.js';
import { getAdminInformation } from '../schema/loader-admin.js';

let cachedVersion = null;
let manualOverride = null;

/**
 * Sets a manual override for Strapi version ('4' | '5' | null).
 * @param {'4' | '5' | null} version
 */
export function setVersionOverride(version) {
	manualOverride = version;
}

/**
 * Detects whether the Strapi instance is version 4 or 5.
 *
 * @param {object} [options]
 * @param {boolean} [options.forceRefresh=false]
 * @returns {Promise<'4' | '5'>}
 */
export async function detectStrapiVersion({ forceRefresh = false } = {}) {
	if (manualOverride) {
		return manualOverride;
	}

	const {
		STRAPI_URL,
		STRAPI_VERSION,
		STRAPI_API_TOKEN,
		STRAPI_ADMIN_EMAIL,
		STRAPI_ADMIN_PASSWORD
	} = getEnv();

	if (STRAPI_VERSION === '4' || STRAPI_VERSION === '5') {
		return STRAPI_VERSION;
	}

	if (!forceRefresh && cachedVersion) {
		return cachedVersion;
	}

	// 1. Try admin information if admin credentials are provided
	if (STRAPI_ADMIN_EMAIL && STRAPI_ADMIN_PASSWORD) {
		try {
			const info = await getAdminInformation(STRAPI_URL, '');
			if (info?.strapiVersion) {
				const major = info.strapiVersion.split('.')[0];
				if (major === '5' || major === '4') {
					cachedVersion = /** @type {'4' | '5'} */ (major);
					return cachedVersion;
				}
			}
		} catch {
			// fallback to REST probe
		}
	}

	// 2. Probe REST endpoint and inspect response shape
	try {
		const testEndpoints = ['/api/service-pages', '/api/articles', '/api/categories'];
		for (const ep of testEndpoints) {
			const headers = STRAPI_API_TOKEN ? { Authorization: `Bearer ${STRAPI_API_TOKEN}` } : {};
			const res = await fetch(`${STRAPI_URL}${ep}?pagination[pageSize]=1`, { headers });
			if (res.ok) {
				const json = await res.json();
				const item = Array.isArray(json.data) ? json.data[0] : json.data;

				if (item) {
					// In Strapi 5, entries have `documentId` at root and flat attributes (no `.attributes`)
					if ('documentId' in item && !('attributes' in item)) {
						cachedVersion = '5';
						return '5';
					}
					// In Strapi 4, entries have `{ id, attributes }`
					if ('attributes' in item) {
						cachedVersion = '4';
						return '4';
					}
				}
			}
		}
	} catch {
		// Default to v5 if unreachable or modern default
	}

	// Default fallback
	cachedVersion = '5';
	return '5';
}
