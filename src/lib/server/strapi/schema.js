import { strapiFetch } from './client.js';
import { normalizeContentType } from '../schema/normalize.js';
import { getEnv } from '../env.js';

let cachedSchemaResult = null;
let cacheExpiresAt = 0;

/**
 * Fetches and dynamically discovers all content types and components from the live Strapi CMS.
 *
 * @param {object} [options]
 * @param {boolean} [options.forceRefresh=false]
 * @returns {Promise<{
 *   source: 'live_strapi',
 *   contentTypes: Record<string, any>,
 *   components: Record<string, any>,
 *   strapiVersion: string,
 *   contentTypesCount: number,
 *   componentsCount: number
 * }>}
 */
export async function getLiveStrapiSchemas({ forceRefresh = false } = {}) {
	const now = Date.now();
	if (!forceRefresh && cachedSchemaResult && now < cacheExpiresAt) {
		return cachedSchemaResult;
	}

	const env = getEnv();
	console.log(`[STRAPI] URL: ${env.STRAPI_URL}`);
	console.log('[STRAPI] Fetching schemas from live Strapi...');

	let ctData = null;
	let compData = null;

	// Query Strapi Content-Type Builder endpoints
	try {
		const [ctRes, compRes] = await Promise.all([
			strapiFetch('/api/content-type-builder/content-types'),
			strapiFetch('/api/content-type-builder/components')
		]);
		ctData = ctRes;
		compData = compRes;
	} catch (primaryErr) {
		// Fallback without /api prefix if Strapi is configured with custom routing
		try {
			const [ctRes, compRes] = await Promise.all([
				strapiFetch('/content-type-builder/content-types'),
				strapiFetch('/content-type-builder/components')
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

	console.log('[STRAPI] Connected successfully');
	console.log(`[STRAPI] Content Types discovered: ${contentTypesCount}`);
	console.log(`[STRAPI] Components discovered: ${componentsCount}`);

	cachedSchemaResult = {
		source: 'live_strapi',
		contentTypes,
		components: componentRegistry,
		strapiVersion: '5',
		contentTypesCount,
		componentsCount
	};
	// Cache for 5 minutes if not force-refreshed
	cacheExpiresAt = now + 5 * 60 * 1000;

	return cachedSchemaResult;
}

/**
 * Retrieves the live schema for a specific content type directly from Strapi.
 *
 * @param {string} uidOrName
 * @param {object} [options]
 * @param {boolean} [options.forceRefresh=false]
 */
export async function getLiveContentTypeSchema(uidOrName, { forceRefresh = false } = {}) {
	const { contentTypes } = await getLiveStrapiSchemas({ forceRefresh });

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
		const apiId = found.kind === 'singleType' ? found.singularName : (found.pluralName || found.singularName);
		console.log(`[STRAPI] Selected Content Type: ${found.displayName || uidOrName}`);
		console.log(`[STRAPI] Type: ${typeLabel}`);
		console.log(`[STRAPI] API ID: ${apiId}`);
		console.log(`[STRAPI] Schema retrieved successfully`);
		return found;
	}

	return null;
}

