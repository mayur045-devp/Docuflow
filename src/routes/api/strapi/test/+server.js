import { json } from '@sveltejs/kit';
import { getEnv } from '$lib/server/env.js';
import { detectStrapiVersion, setVersionOverride } from '$lib/server/strapi/detect-version.js';
import { strapiFetch } from '$lib/server/strapi/client.js';

export async function POST({ request }) {
	const env = getEnv();

	let body;
	try {
		body = await request.json();
	} catch {
		body = {};
	}

	if (body.overrideVersion) {
		setVersionOverride(body.overrideVersion);
	}

	try {
		const version = await detectStrapiVersion({ forceRefresh: true });

		// Probe test query
		let tokenValid = false;
		try {
			await strapiFetch('/api/service-pages?pagination[pageSize]=1');
			tokenValid = true;
		} catch (err) {
			// If 404 or 403, check status
			// @ts-ignore
			if (err?.status !== 401) {
				tokenValid = true;
			}
		}

		return json({
			reachable: true,
			url: env.STRAPI_URL,
			version,
			tokenConfigured: Boolean(env.STRAPI_API_TOKEN),
			tokenValid
		});
	} catch (err) {
		return json({
			reachable: false,
			url: env.STRAPI_URL,
			error: err instanceof Error ? err.message : String(err)
		});
	}
}
