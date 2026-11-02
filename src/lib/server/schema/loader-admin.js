import { getEnv } from '../env.js';
import { normalizeContentType } from './normalize.js';

let cachedToken = null;
let tokenExpiresAt = 0;
let cachedResult = null;
let cacheExpiresAt = 0;

/**
 * Logs into Strapi Admin API and caches the admin JWT.
 * @param {string} strapiUrl
 * @param {string} email
 * @param {string} password
 * @returns {Promise<string>}
 */
async function getAdminToken(strapiUrl, email, password) {
	const now = Date.now();
	if (cachedToken && now < tokenExpiresAt) {
		return cachedToken;
	}

	const res = await fetch(`${strapiUrl}/admin/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password })
	});

	if (!res.ok) {
		throw new Error(`Admin login failed: ${res.status} ${res.statusText}`);
	}

	const data = await res.json();
	const token = data.data?.token || data.token;
	if (!token) {
		throw new Error('Admin login response did not contain a valid token');
	}

	cachedToken = token;
	// Expire token in 2 hours
	tokenExpiresAt = now + 2 * 60 * 60 * 1000;
	return cachedToken;
}

/**
 * Fetches admin information including detected Strapi version.
 * @param {string} strapiUrl
 * @param {string} adminToken
 * @returns {Promise<{ strapiVersion?: string }>}
 */
export async function getAdminInformation(strapiUrl, adminToken) {
	try {
		const res = await fetch(`${strapiUrl}/admin/information`, {
			headers: { Authorization: `Bearer ${adminToken}` }
		});
		if (res.ok) {
			const json = await res.json();
			return json.data || json;
		}
	} catch {
		// Ignore if endpoint is not reachable
	}
	return {};
}

/**
 * Loads content types and components directly from Strapi admin API.
 * @param {object} [options]
 * @param {boolean} [options.forceRefresh=false]
 * @returns {Promise<{ contentTypes: Record<string, any>, components: Record<string, any>, strapiVersion?: string } | null>}
 */
export async function loadSchemasFromAdmin({ forceRefresh = false } = {}) {
	const { STRAPI_URL, STRAPI_ADMIN_EMAIL, STRAPI_ADMIN_PASSWORD } = getEnv();
	if (!STRAPI_ADMIN_EMAIL || !STRAPI_ADMIN_PASSWORD) {
		return null;
	}

	const now = Date.now();
	if (forceRefresh) {
		cachedResult = null;
		cacheExpiresAt = 0;
	} else if (cachedResult && now < cacheExpiresAt) {
		return cachedResult;
	}

	try {
		const token = await getAdminToken(STRAPI_URL, STRAPI_ADMIN_EMAIL, STRAPI_ADMIN_PASSWORD);
		const headers = { Authorization: `Bearer ${token}` };

		// Fetch admin info for Strapi version
		const adminInfo = await getAdminInformation(STRAPI_URL, token);

		// Fetch content-type-builder endpoints
		const [ctRes, compRes] = await Promise.all([
			fetch(`${STRAPI_URL}/content-type-builder/content-types`, { headers }),
			fetch(`${STRAPI_URL}/content-type-builder/components`, { headers })
		]);

		if (!ctRes.ok || !compRes.ok) {
			return null;
		}

		const ctData = await ctRes.json();
		const compData = await compRes.json();

		const rawComponentsList = compData.data || [];
		const rawContentTypesList = ctData.data || [];

		/** @type {Record<string, any>} */
		const componentRegistry = {};
		for (const comp of rawComponentsList) {
			const uid = comp.uid;
			const schema = comp.schema || comp;
			componentRegistry[uid] = schema;
		}

		/** @type {Record<string, any>} */
		const contentTypes = {};
		for (const ct of rawContentTypesList) {
			const uid = ct.uid;
			// Filter out plugin / admin system content types
			if (uid && uid.startsWith('api::')) {
				const rawSchema = ct.schema || ct;
				contentTypes[uid] = normalizeContentType(rawSchema, componentRegistry);
			}
		}

		cachedResult = {
			contentTypes,
			components: componentRegistry,
			strapiVersion: adminInfo.strapiVersion
		};
		// Cache for 10 minutes
		cacheExpiresAt = now + 10 * 60 * 1000;

		return cachedResult;
	} catch (_err) {
		// Reset cached token on error so next attempt tries fresh login
		cachedToken = null;
		tokenExpiresAt = 0;
		return null;
	}
}
