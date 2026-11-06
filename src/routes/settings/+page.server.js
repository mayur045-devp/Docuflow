import { resolveAvailableSchemas } from '$lib/server/schema/resolve.js';
import { detectStrapiVersion } from '$lib/server/strapi/detect-version.js';
import { getEnv } from '$lib/server/env.js';
import { getActiveConnection } from '$lib/server/strapi/connection.js';

export async function load() {
	const env = getEnv();
	const activeConn = getActiveConnection();

	let schemas = { source: 'live_strapi', contentTypes: {} };
	try {
		schemas = await resolveAvailableSchemas();
	} catch (err) {
		console.warn('Settings load: schemas could not be retrieved from Strapi:', err);
	}

	const version = await detectStrapiVersion();

	return {
		config: {
			strapiUrl: activeConn.strapiUrl,
			strapiVersionConfigured: activeConn.version,
			detectedVersion: version,
			hasToken: Boolean(activeConn.apiToken),
			aiProvider: env.AI_PROVIDER,
			geminiModel: env.GEMINI_MODEL
		},
		schemaSource: schemas.source,
		contentTypes: Object.values(schemas.contentTypes || {})
	};
}
