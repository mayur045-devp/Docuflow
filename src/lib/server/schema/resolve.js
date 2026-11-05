import { getLiveStrapiSchemas, getLiveContentTypeSchema } from '../strapi/schema.js';
import { getUploadedSchemas } from './loader-upload.js';

/**
 * Resolves all available content types from the live Strapi CMS.
 *
 * @param {object} [options]
 * @param {boolean} [options.forceRefresh=false]
 * @returns {Promise<{
 *   source: 'live_strapi' | 'manual_upload',
 *   contentTypes: Record<string, any>,
 *   components?: Record<string, any>,
 *   strapiVersion?: string,
 *   contentTypesCount?: number,
 *   componentsCount?: number
 * }>}
 */
export async function resolveAvailableSchemas({ forceRefresh = false } = {}) {
	try {
		const liveResult = await getLiveStrapiSchemas({ forceRefresh });
		if (liveResult && Object.keys(liveResult.contentTypes).length > 0) {
			return {
				source: 'live_strapi',
				contentTypes: liveResult.contentTypes,
				components: liveResult.components,
				strapiVersion: liveResult.strapiVersion,
				contentTypesCount: liveResult.contentTypesCount,
				componentsCount: liveResult.componentsCount
			};
		}
	} catch (err) {
		console.error('[STRAPI] Schema resolution failed from live Strapi:', err instanceof Error ? err.message : String(err));

		// If user manually registered a schema in this session, allow it
		const uploaded = getUploadedSchemas();
		if (Object.keys(uploaded.contentTypes).length > 0) {
			return {
				source: 'manual_upload',
				contentTypes: uploaded.contentTypes
			};
		}

		throw err;
	}

	const uploaded = getUploadedSchemas();
	if (Object.keys(uploaded.contentTypes).length > 0) {
		return {
			source: 'manual_upload',
			contentTypes: uploaded.contentTypes
		};
	}

	throw new Error(
		'No content types could be discovered from Strapi pre-production instance. Please verify connection and permissions.'
	);
}

/**
 * Gets a specific normalized ContentTypeDef by its UID or singularName from live Strapi.
 *
 * @param {string} uidOrName
 * @param {object} [options]
 * @param {boolean} [options.forceRefresh=false]
 * @returns {Promise<any|null>}
 */
export async function getContentTypeSchema(uidOrName, { forceRefresh = false } = {}) {
	try {
		return await getLiveContentTypeSchema(uidOrName, { forceRefresh });
	} catch {
		const { contentTypes } = await resolveAvailableSchemas({ forceRefresh });
		if (contentTypes[uidOrName]) return contentTypes[uidOrName];
		for (const ct of Object.values(contentTypes)) {
			if (ct.singularName === uidOrName || ct.pluralName === uidOrName || ct.uid === uidOrName) {
				return ct;
			}
		}
		return null;
	}
}
