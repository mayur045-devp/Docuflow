import { testStrapiConnection, normalizeStrapiUrl, buildStrapiEndpointUrl } from '../src/lib/server/strapi/connection.js';
import fs from 'fs';
import path from 'path';

// Load .env manually if process.env.STRAPI_API_TOKEN is not already set
if (!process.env.STRAPI_API_TOKEN) {
	try {
		const envPath = path.resolve('.env');
		if (fs.existsSync(envPath)) {
			const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
			for (const line of envLines) {
				const trimmed = line.trim();
				if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
					const idx = trimmed.indexOf('=');
					const key = trimmed.slice(0, idx).trim();
					const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
					process.env[key] = val;
				}
			}
		}
	} catch (e) {
		console.warn('Could not read .env file:', e);
	}
}

async function runVerification() {
	console.log('====================================================');
	console.log('MULTI-STRAPI COMPREHENSIVE VERIFICATION SUITE');
	console.log('====================================================\n');

	// 1. URL Normalization Unit Checks
	console.log('--- TEST E: URL Normalization Checks ---');
	const testUrls = [
		{ input: 'https://strapi-preprod.testlifecycle.com/', expected: 'https://strapi-preprod.testlifecycle.com' },
		{ input: 'https://strapi-preprod.testlifecycle.com///', expected: 'https://strapi-preprod.testlifecycle.com' },
		{ input: 'https://strapi-preprod.12thwonder.com', expected: 'https://strapi-preprod.12thwonder.com' },
		{ input: 'https://custom-strapi.com/strapi-subpath/', expected: 'https://custom-strapi.com/strapi-subpath' }
	];

	for (const { input, expected } of testUrls) {
		const normalized = normalizeStrapiUrl(input);
		const pass = normalized === expected;
		console.log(`Normalize "${input}" -> "${normalized}" [${pass ? 'PASS' : 'FAIL'}]`);
		if (!pass) throw new Error(`Normalization failed for ${input}`);
	}

	const endpointTest1 = buildStrapiEndpointUrl('https://strapi-preprod.testlifecycle.com/', '/api/content-type-builder/content-types');
	console.log(`Endpoint builder (trailing slash base): "${endpointTest1}"`);
	if (endpointTest1.includes('//api')) throw new Error('Endpoint builder produced double slash //api!');
	console.log('Endpoint builder test passed: no double slashes.\n');

	// 2. Test A: Current configured Strapi in .env
	console.log(`--- TEST A: Active configured Strapi (${process.env.STRAPI_URL}) ---`);
	const token = process.env.STRAPI_API_TOKEN;
	const resA = await testStrapiConnection({
		strapiUrl: process.env.STRAPI_URL,
		apiToken: token
	});
	console.log('Test A Result:');
	console.log({
		success: resA.success,
		authenticated: resA.authenticated,
		apiReachable: resA.apiReachable,
		schemaDiscoveryAvailable: resA.schemaDiscoveryAvailable,
		version: resA.version,
		contentTypesCount: resA.contentTypesCount,
		componentsCount: resA.componentsCount,
		normalizedUrl: resA.normalizedUrl
	});
	if (!resA.success) {
		throw new Error(`Test A failed: ${resA.message}`);
	}
	console.log('Test A: PASSED\n');

	// 3. Test C: Invalid Token (HTTP 401)
	console.log('--- TEST C: Invalid Token Check (HTTP 401 Diagnostic) ---');
	const resC = await testStrapiConnection({
		strapiUrl: 'https://strapi-preprod.12thwonder.com',
		apiToken: 'invalid_dummy_token_12345'
	});
	console.log('Test C Result:');
	console.log({
		success: resC.success,
		authenticated: resC.authenticated,
		apiReachable: resC.apiReachable,
		status: resC.status,
		errorCode: resC.errorCode,
		message: resC.message
	});
	if (resC.status !== 401 || resC.errorCode !== 'INVALID_API_TOKEN') {
		throw new Error(`Test C expected 401 / INVALID_API_TOKEN, got: ${resC.status} / ${resC.errorCode}`);
	}
	console.log('Test C: PASSED (Properly classified 401 without generic failure)\n');

	// 4. Test D: Invalid URL (Network failure diagnostic)
	console.log('--- TEST D: Invalid Non-Existent Host Check (Network Failure Diagnostic) ---');
	const resD = await testStrapiConnection({
		strapiUrl: 'https://invalid-non-existent-subdomain-12345.com',
		apiToken: 'any_token'
	});
	console.log('Test D Result:');
	console.log({
		success: resD.success,
		apiReachable: resD.apiReachable,
		errorCode: resD.errorCode,
		message: resD.message
	});
	if (resD.apiReachable !== false || resD.errorCode !== 'NETWORK_ERROR') {
		throw new Error(`Test D expected NETWORK_ERROR, got: ${resD.errorCode}`);
	}
	console.log('Test D: PASSED (Accurately identified network/DNS failure)\n');

	// 5. Test B: strapi-preprod.testlifecycle.com/ with trailing slash
	console.log('--- TEST B: strapi-preprod.testlifecycle.com/ (with .env token) ---');
	const resB = await testStrapiConnection({
		strapiUrl: 'https://strapi-preprod.testlifecycle.com/',
		apiToken: process.env.STRAPI_API_TOKEN
	});
	console.log('Test B Result:');
	console.log({
		success: resB.success,
		authenticated: resB.authenticated,
		apiReachable: resB.apiReachable,
		schemaDiscoveryAvailable: resB.schemaDiscoveryAvailable,
		version: resB.version,
		contentTypesCount: resB.contentTypesCount,
		componentsCount: resB.componentsCount,
		normalizedUrl: resB.normalizedUrl,
		message: resB.message
	});
	if (!resB.success) {
		throw new Error(`Test B failed: ${resB.message}`);
	}
	console.log('Test B: PASSED (Successfully connected to strapi-preprod.testlifecycle.com!)\n');

	console.log('====================================================');
	console.log('ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
	console.log('====================================================');
}

runVerification().catch((err) => {
	console.error('Verification failed:', err);
	process.exit(1);
});
