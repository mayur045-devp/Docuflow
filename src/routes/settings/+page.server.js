import { resolveAvailableSchemas } from '$lib/server/schema/resolve.js';
import { detectStrapiVersion } from '$lib/server/strapi/detect-version.js';
import { getEnv } from '$lib/server/env.js';

export async function load() {
	const env = getEnv();
	const schemas = await resolveAvailableSchemas();
	const version = await detectStrapiVersion();

	return {
		config: {
			strapiUrl: env.STRAPI_URL,
			strapiVersionConfigured: env.STRAPI_VERSION,
			detectedVersion: version,
			hasToken: Boolean(env.STRAPI_API_TOKEN),
			hasAdminCreds: Boolean(env.STRAPI_ADMIN_EMAIL && env.STRAPI_ADMIN_PASSWORD),
			projectPath: env.STRAPI_PROJECT_PATH || '',
			aiProvider: env.AI_PROVIDER,
			geminiModel: env.GEMINI_MODEL
		},
		schemaSource: schemas.source,
		contentTypes: Object.values(schemas.contentTypes || {})
	};
}
