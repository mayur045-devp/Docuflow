import path from 'node:path';
import { getEnv } from '../env.js';
import { loadSchemasFromFiles } from './loader-files.js';
import { loadSchemasFromAdmin } from './loader-admin.js';
import { getUploadedSchemas } from './loader-upload.js';
import { loadSchemasFromLiveEndpoint } from './loader-endpoint.js';

/**
 * Resolves all available content types from the prioritized schema sources.
 * @param {object} [options]
 * @param {boolean} [options.forceRefresh=false]
 * @returns {Promise<{
 *   source: 'live_endpoint' | 'local_project' | 'admin_discovery' | 'manual_upload' | 'bundled_fixtures',
 *   contentTypes: Record<string, any>,
 *   strapiVersion?: string
 * }>}
 */
export async function resolveAvailableSchemas({ forceRefresh = false } = {}) {
	const env = getEnv();

	// 1. Live Strapi schema endpoint (if Strapi is running and reachable)
	try {
		const liveResult = await loadSchemasFromLiveEndpoint({ forceRefresh, timeoutMs: 2500 });
		if (liveResult && Object.keys(liveResult.contentTypes).length > 0) {
			return {
				source: 'live_endpoint',
				contentTypes: liveResult.contentTypes,
				strapiVersion: liveResult.strapiVersion
			};
		}
	} catch {
		// Continue to next priority
	}

	// 2. Local project files (if configured)
	if (env.STRAPI_PROJECT_PATH) {
		const result = loadSchemasFromFiles(env.STRAPI_PROJECT_PATH);
		if (Object.keys(result.contentTypes).length > 0) {
			return {
				source: 'local_project',
				contentTypes: result.contentTypes
			};
		}
	}

	// 2. Live admin discovery (if admin creds provided)
	if (env.STRAPI_ADMIN_EMAIL && env.STRAPI_ADMIN_PASSWORD) {
		const adminResult = await loadSchemasFromAdmin({ forceRefresh });
		if (adminResult && Object.keys(adminResult.contentTypes).length > 0) {
			return {
				source: 'admin_discovery',
				contentTypes: adminResult.contentTypes,
				strapiVersion: adminResult.strapiVersion
			};
		}
	}

	// 3. User manual uploads
	const uploaded = getUploadedSchemas();
	if (Object.keys(uploaded.contentTypes).length > 0) {
		return {
			source: 'manual_upload',
			contentTypes: uploaded.contentTypes
		};
	}

	// 4. Default bundled fixtures (Service Page and Article)
	const bundledPath = path.resolve('fixtures/schemas');
	const bundled = loadSchemasFromFiles(bundledPath);

	return {
		source: 'bundled_fixtures',
		contentTypes: bundled.contentTypes
	};
}

/**
 * Gets a specific normalized ContentTypeDef by its UID or singularName.
 * @param {string} uidOrName
 * @param {object} [options]
 * @param {boolean} [options.forceRefresh=false]
 * @returns {Promise<any|null>}
 */
export async function getContentTypeSchema(uidOrName, { forceRefresh = false } = {}) {
	const { contentTypes } = await resolveAvailableSchemas({ forceRefresh });

	if (contentTypes[uidOrName]) {
		return contentTypes[uidOrName];
	}

	// Search by singularName or pluralName
	for (const ct of Object.values(contentTypes)) {
		if (ct.singularName === uidOrName || ct.pluralName === uidOrName || ct.uid === uidOrName) {
			return ct;
		}
	}

	return null;
}
