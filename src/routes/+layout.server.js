import { getActiveConnection } from '$lib/server/strapi/connection.js';

export async function load() {
	try {
		const conn = getActiveConnection();
		return {
			strapiUrl: conn.strapiUrl
		};
	} catch {
		return {
			strapiUrl: ''
		};
	}
}
