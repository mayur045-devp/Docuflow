import { resolveAvailableSchemas } from '$lib/server/schema/resolve.js';
import { detectStrapiVersion } from '$lib/server/strapi/detect-version.js';
import { getEnv } from '$lib/server/env.js';

export async function load() {
	const env = getEnv();
	let schemas = { source: 'live_strapi', contentTypes: {} };
	try {
		schemas = await resolveAvailableSchemas();
	} catch (err) {
		console.warn('Settings load: schemas could not be retrieved from Strapi:', err);
	}

	const version = await detectStrapiVersion();

	return {
		config: {
			strapiUrl: env.STRAPI_URL,
			strapiVersionConfigured: env.STRAPI_VERSION,
			detectedVersion: version,
			hasToken: Boolean(env.STRAPI_API_TOKEN),
			aiProvider: env.AI_PROVIDER,
			geminiModel: env.GEMINI_MODEL
		},
		schemaSource: schemas.source,
		contentTypes: Object.values(schemas.contentTypes || {})
	};
}
