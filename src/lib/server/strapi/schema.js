import { strapiFetch } from './client.js';
import { normalizeContentType } from '../schema/normalize.js';
import {
	getActiveConnection,
	getConnectionKey,
	onConnectionChange,
	normalizeStrapiUrl
} from './connection.js';

// Cache map keyed by connection identity (normalizedUrl + token hash)
const schemaCaches = new Map();

// Invalidate all caches whenever the active connection is changed or reset
onConnectionChange(() => {
	schemaCaches.clear();
	console.log('[Strapi Schema] All schema caches cleared due to connection change.');
});

/**
 * Clears all cached Strapi schemas across all connections.
 */
export function clearSchemaCaches() {
	schemaCaches.clear();
}

/**
 * Fetches and dynamically discovers all content types and components from the target Strapi CMS.
 *
 * @param {object} [options]
 * @param {boolean} [options.forceRefresh=false]
 * @param {{ strapiUrl: string, apiToken?: string }} [options.connection]
 * @returns {Promise<{
 *   source: 'live_strapi',
 *   baseUrl: string,
 *   normalizedUrl: string,
 *   contentTypes: Record<string, any>,
 *   components: Record<string, any>,
 *   strapiVersion: string,
 *   contentTypesCount: number,
 *   componentsCount: number
 * }>}
 */
export async function getLiveStrapiSchemas({ forceRefresh = false, connection = null } = {}) {
	const conn = connection || getActiveConnection();
	const normalizedUrl = normalizeStrapiUrl(conn.strapiUrl);
	const cacheKey = getConnectionKey(normalizedUrl, conn.apiToken);

	const now = Date.now();
	const cached = schemaCaches.get(cacheKey);

	if (!forceRefresh && cached && now < cached.expiresAt) {
		return cached.data;
	}

	let host = 'unknown';
	try {
		host = new URL(normalizedUrl).host;
	} catch {
		// ignore
	}

	console.log(`[STRAPI] URL: ${normalizedUrl}`);
	console.log(`[STRAPI] Fetching live schemas from Host: ${host}...`);

	let ctData = null;
	let compData = null;

	// Query Strapi Content-Type Builder endpoints
	try {
		const [ctRes, compRes] = await Promise.all([
			strapiFetch('/api/content-type-builder/content-types', { connection: conn }),
			strapiFetch('/api/content-type-builder/components', { connection: conn })
		]);
		ctData = ctRes;
		compData = compRes;
	} catch (primaryErr) {
		// Fallback without /api prefix if Strapi is configured with custom routing
		try {
			const [ctRes, compRes] = await Promise.all([
				strapiFetch('/content-type-builder/content-types', { connection: conn }),
				strapiFetch('/content-type-builder/components', { connection: conn })
			]);
			ctData = ctRes;
			compData = compRes;
		} catch {
			throw primaryErr;
		}
	}

	const rawComponentsList = compData?.data || [];
	const rawContentTypesList = ctData?.data || [];

	/** @type {Record<string, any>} */
	const componentRegistry = {};
	for (const comp of rawComponentsList) {
		const uid = comp.uid;
		componentRegistry[uid] = comp.schema || comp;
	}

	/** @type {Record<string, any>} */
	const contentTypes = {};
	for (const ct of rawContentTypesList) {
		const uid = ct.uid;
		// Discover all application content types (api::*) and plugin users
		if (uid && (uid.startsWith('api::') || uid === 'plugin::users-permissions.user')) {
			const rawSchema = {
				...(ct.schema || ct),
				uid: ct.uid,
				apiID: ct.apiID
			};
			contentTypes[uid] = normalizeContentType(rawSchema, componentRegistry);
		}
	}

	const contentTypesCount = Object.keys(contentTypes).length;
	const componentsCount = Object.keys(componentRegistry).length;

	console.log(`[STRAPI] Schema discovery successful for Host: ${host}`);
	console.log(`[STRAPI] Content Types discovered: ${contentTypesCount}`);
	console.log(`[STRAPI] Components discovered: ${componentsCount}`);

	const resultData = {
		source: /** @type {const} */ ('live_strapi'),
		baseUrl: conn.strapiUrl,
		normalizedUrl,
		contentTypes,
		components: componentRegistry,
		strapiVersion: '5',
		contentTypesCount,
		componentsCount
	};

	// Cache for 5 minutes if not forced
	schemaCaches.set(cacheKey, {
		data: resultData,
		expiresAt: now + 5 * 60 * 1000
	});

	return resultData;
}

/**
 * Retrieves the live schema for a specific content type directly from Strapi.
 *
 * @param {string} uidOrName
 * @param {object} [options]
 * @param {boolean} [options.forceRefresh=false]
 * @param {{ strapiUrl: string, apiToken?: string }} [options.connection]
 */
export async function getLiveContentTypeSchema(
	uidOrName,
	{ forceRefresh = false, connection = null } = {}
) {
	const { contentTypes } = await getLiveStrapiSchemas({ forceRefresh, connection });

	let found = contentTypes[uidOrName] || null;

	if (!found) {
		for (const ct of Object.values(contentTypes)) {
			if (ct.singularName === uidOrName || ct.pluralName === uidOrName || ct.uid === uidOrName) {
				found = ct;
				break;
			}
		}
	}

	if (found) {
		const typeLabel = found.kind === 'singleType' ? 'Single Type' : 'Collection Type';
		const apiId =
			found.kind === 'singleType'
				? found.singularName
				: found.pluralName || found.singularName;
		console.log(`[STRAPI] Selected Content Type: ${found.displayName || uidOrName}`);
		console.log(`[STRAPI] Type: ${typeLabel}`);
		console.log(`[STRAPI] API ID: ${apiId}`);
		console.log(`[STRAPI] Schema retrieved successfully`);
		return found;
	}

	return null;
}
