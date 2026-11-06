import {
	getActiveConnection,
	buildStrapiEndpointUrl,
	normalizeStrapiUrl,
	onConnectionChange
} from './connection.js';

let cachedVersion = null;
let manualOverride = null;

onConnectionChange(() => {
	cachedVersion = null;
});

/**
 * Sets a manual override for Strapi version ('4' | '5' | null).
 * @param {'4' | '5' | null} version
 */
export function setVersionOverride(version) {
	manualOverride = version;
}

/**
 * Detects whether the target Strapi instance is version 4 or 5.
 *
 * @param {object} [options]
 * @param {boolean} [options.forceRefresh=false]
 * @param {{ strapiUrl: string, apiToken?: string, version?: string }} [options.connection]
 * @returns {Promise<'4' | '5'>}
 */
export async function detectStrapiVersion({ forceRefresh = false, connection = null } = {}) {
	if (manualOverride) {
		return manualOverride;
	}

	const conn = connection || getActiveConnection();
	const strapiUrl = normalizeStrapiUrl(conn.strapiUrl);
	const strapiToken = conn.apiToken || '';

	if (conn.version === '4' || conn.version === '5') {
		return conn.version;
	}

	if (!forceRefresh && cachedVersion) {
		return cachedVersion;
	}

	const headers = new Headers();
	if (strapiToken) {
		headers.set('Authorization', `Bearer ${strapiToken}`);
	}

	// 1. Probe Content-Type Builder to check schema format
	try {
		const ctbUrl = buildStrapiEndpointUrl(
			strapiUrl,
			'/api/content-type-builder/content-types'
		);
		const ctbRes = await fetch(ctbUrl, { headers });
		if (ctbRes.ok) {
			const json = await ctbRes.json();
			const items = json.data || [];
			// Find any collection type from discovered schema to test entry shape
			const collectionItem = items.find(
				(i) => i.uid?.startsWith('api::') && i.schema?.kind === 'collectionType'
			);

			if (collectionItem?.schema?.pluralName) {
				const entryUrl = buildStrapiEndpointUrl(
					strapiUrl,
					`/api/${collectionItem.schema.pluralName}?pagination[pageSize]=1`
				);
				const entryRes = await fetch(entryUrl, { headers });
				if (entryRes.ok) {
					const entryJson = await entryRes.json();
					const sample = Array.isArray(entryJson.data) ? entryJson.data[0] : entryJson.data;
					if (sample) {
						if ('documentId' in sample && !('attributes' in sample)) {
							cachedVersion = '5';
							return '5';
						}
						if ('attributes' in sample) {
							cachedVersion = '4';
							return '4';
						}
					}
				}
			}
		}
	} catch {
		// fallback to v5
	}

	cachedVersion = '5';
	return '5';
}
