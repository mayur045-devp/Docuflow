import { getEnv } from '$lib/server/env.js';

export async function load() {
	try {
		const env = getEnv();
		return {
			strapiUrl: env.STRAPI_URL
		};
	} catch {
		return {
			strapiUrl: ''
		};
	}
}

