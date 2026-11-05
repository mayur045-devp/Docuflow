import { json } from '@sveltejs/kit';
import { getEnv } from '$lib/server/env.js';
import { getLiveStrapiSchemas } from '$lib/server/strapi/schema.js';
import { strapiFetch } from '$lib/server/strapi/client.js';

export async function POST() {
	let env;
	try {
		env = getEnv();
	} catch (configErr) {
		return json({
			reachable: false,
			status: 'error',
			error: 'STRAPI_URL or STRAPI_API_TOKEN is not configured. Please configure the pre-production Strapi connection in .env.'
		}, { status: 500 });
	}

	const strapiUrl = env.STRAPI_URL;

	try {
		// 1. Test basic connectivity and API access
		console.log(`[STRAPI] Testing connection to ${strapiUrl}...`);

		// 2. Discover live schemas (content types & components) with forced refresh
		const schemaResult = await getLiveStrapiSchemas({ forceRefresh: true });

		const contentTypesCount = schemaResult.contentTypesCount || Object.keys(schemaResult.contentTypes || {}).length;
		const componentsCount = schemaResult.componentsCount || Object.keys(schemaResult.components || {}).length;

		// 3. Test content API accessibility
		let contentApiAccessible = false;
		try {
			await strapiFetch('/api/users?pagination[pageSize]=1');
			contentApiAccessible = true;
		} catch {
			// Even if /api/users is restricted, if content types were fetched, the API is accessible
			contentApiAccessible = contentTypesCount > 0;
		}

		console.log(`[STRAPI] Test successful: ${contentTypesCount} content types, ${componentsCount} components discovered`);

		return json({
			reachable: true,
			status: 'connected',
			url: strapiUrl,
			version: schemaResult.strapiVersion || '5',
			contentTypesCount,
			componentsCount,
			tokenConfigured: true,
			contentApiAccessible,
			schemaDiscoveryWorking: contentTypesCount > 0
		});
	} catch (err) {
		console.error('[STRAPI] Connection test failed:', err);

		// @ts-ignore
		const status = err?.status;
		let errorMessage = 'Unable to connect to Strapi.';
		let possibleCauses = [
			'Invalid STRAPI_URL',
			'Invalid or expired STRAPI_API_TOKEN',
			'API permissions in Strapi Settings > API Tokens',
			'Network or firewall restrictions',
			'Strapi instance is down or unavailable'
		];

		if (status === 401) {
			errorMessage = 'Strapi authentication failed. The configured API token is invalid or has expired.';
			possibleCauses = [
				'Invalid STRAPI_API_TOKEN in .env',
				'API token was deleted or revoked in Strapi Admin',
				'Token does not have appropriate permissions'
			];
		} else if (status === 403) {
			errorMessage = 'Strapi permission denied. The configured API token lacks Content-Type Builder or Content API access.';
			possibleCauses = [
				'API token needs "Full Access" or "Custom" permissions enabling Content-Type Builder and Content API in Strapi Admin',
				'Role-based access permissions restricting API token'
			];
		} else if (err instanceof Error && (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND'))) {
			errorMessage = `Unable to reach Strapi server at ${strapiUrl}.`;
			possibleCauses = [
				'Pre-production Strapi server is offline',
				'Incorrect domain or port in STRAPI_URL',
				'DNS resolution failure or firewall/network block'
			];
		}

		return json({
			reachable: false,
			status: 'error',
			url: strapiUrl,
			error: errorMessage,
			possibleCauses,
			details: err instanceof Error ? err.message : String(err)
		}, { status: 502 });
	}
}
