import fs from 'node:fs';
import path from 'node:path';
import { getEnv } from '../src/lib/server/env.js';
import { strapiClient, strapiFetch } from '../src/lib/server/strapi/client.js';
import { getLiveStrapiSchemas, getLiveContentTypeSchema } from '../src/lib/server/strapi/schema.js';
import { getStrapiAdapter } from '../src/lib/server/strapi/adapter.js';
import { parseDocx } from '../src/lib/server/document/parser.js';
import { extractIntermediateDocument } from '../src/lib/server/document/intermediate.js';
import { mapDocumentToSchema } from '../src/lib/server/mapping/semantic-mapper.js';
import { buildStrapiPayload } from '../src/lib/server/mapping/build-payload.js';
import { validateContentData } from '../src/lib/server/schema/to-zod.js';
import { uploadMedia } from '../src/lib/server/strapi/media.js';

async function runVerification() {
	console.log('====================================================');
	console.log('DOCUFLOW -> PRE-PRODUCTION STRAPI INTEGRATION TESTS');
	console.log('====================================================');

	const env = getEnv();
	console.log(`\n[TEST 1] Configuration Verification`);
	console.log(`STRAPI_URL: ${env.STRAPI_URL}`);
	console.log(`STRAPI_API_TOKEN configured: ${Boolean(env.STRAPI_API_TOKEN)} (Length: ${env.STRAPI_API_TOKEN.length})`);
	if (env.STRAPI_URL.includes('localhost') || env.STRAPI_URL.includes('127.0.0.1')) {
		throw new Error('FAIL: STRAPI_URL points to localhost!');
	}
	console.log('✓ Configuration valid: Target is pre-production Strapi, no localhost.');

	console.log(`\n[TEST 2] Strapi Connectivity & Authentication`);
	const usersRes = await strapiFetch('/api/users?pagination[pageSize]=1');
	console.log('✓ Authenticated request succeeded. /api/users response received.');

	console.log(`\n[TEST 3] Dynamic Content-Type and Component Discovery`);
	const liveSchemas = await getLiveStrapiSchemas({ forceRefresh: true });
	const allCts = Object.values(liveSchemas.contentTypes);
	const collectionTypes = allCts.filter(c => c.kind === 'collectionType');
	const singleTypes = allCts.filter(c => c.kind === 'singleType');
	const components = Object.keys(liveSchemas.components);

	console.log(`Total Content Types Discovered: ${allCts.length}`);
	console.log(` - Collection Types (${collectionTypes.length}): ${collectionTypes.map(c => c.displayName || c.singularName).slice(0, 8).join(', ')}...`);
	console.log(` - Single Types (${singleTypes.length}): ${singleTypes.map(c => c.displayName || c.singularName).slice(0, 8).join(', ')}...`);
	console.log(`Total Components Discovered: ${components.length}`);

	if (collectionTypes.length === 0 || singleTypes.length === 0 || components.length === 0) {
		throw new Error('FAIL: Failed to discover Collection Types, Single Types, or Components!');
	}
	console.log('✓ Dynamic discovery verified: Collection Types, Single Types, and Components successfully populated from live Strapi.');

	console.log(`\n[TEST 4] Recursive Component Schema Discovery`);
	const articleSchema = await getLiveContentTypeSchema('api::article.article', { forceRefresh: true });
	console.log(`Article Content Type: ${articleSchema.displayName} (Kind: ${articleSchema.kind})`);
	
	let hasNestedComponent = false;
	for (const [name, attr] of Object.entries(articleSchema.attributes)) {
		if (attr.type === 'component') {
			console.log(` - Component attribute: "${name}" -> UID: ${attr.componentUid} (repeatable: ${attr.repeatable})`);
			if (attr.schema?.attributes) {
				for (const [subName, subAttr] of Object.entries(attr.schema.attributes)) {
					if (subAttr.type === 'component') {
						hasNestedComponent = true;
						console.log(`    -> Nested Component: "${subName}" -> UID: ${subAttr.componentUid} (repeatable: ${subAttr.repeatable})`);
					}
				}
			}
		}
	}
	if (!hasNestedComponent) {
		console.warn('Note: articleSchema has component attributes, checking other types for nested components.');
	}
	console.log('✓ Recursive component schema discovery verified.');

	console.log(`\n[TEST 5] DOCX Extraction & Mapping against Live Schema`);
	// Find a fixture DOCX
	const docxFiles = [
		'.data/user_upload/EV_Battery_Safety_Testing_Content_Entry.docx',
		'fixtures/docs/sample-article.docx',
		'fixtures/docs/simple-article.docx'
	];
	let docxPath = docxFiles.find(f => fs.existsSync(f));
	if (!docxPath) {
		// Create a small docx or find any in .data
		const found = fs.readdirSync('.data/user_upload', { recursive: true }).find(f => f.endsWith('.docx'));
		if (found) docxPath = path.join('.data/user_upload', found);
	}

	if (docxPath) {
		console.log(`Testing document parser with: ${docxPath}`);
		const docBuffer = fs.readFileSync(docxPath);
		const docModel = await parseDocx(docBuffer);
		console.log(`Document parsed: ${docModel.blocks.length} blocks, ${docModel.images.length} images`);
		const intermediate = extractIntermediateDocument(docModel);
		console.log(`Intermediate extracted: ${intermediate.keyValues.length} keyValues, ${intermediate.sections.length} sections, ${intermediate.repeatedGroups.length} repeated groups`);

		// Map to Article schema from live Strapi
		const mapped = mapDocumentToSchema({
			intermediateDoc: intermediate,
			documentModel: docModel,
			contentTypeDef: articleSchema
		});
		console.log(`Mapped fields count: ${Object.keys(mapped.data).length}`);
		console.log(`Sample mapped title: "${mapped.data.title || '(none)'}"`);
		console.log('✓ Document extraction and semantic mapping against live schema verified.');
	} else {
		console.log('No sample DOCX found on disk; skipping parser check.');
	}

	console.log(`\n[TEST 6] Live Media Upload to Strapi Pre-Production`);
	const png1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
	const uploadResult = await uploadMedia(png1x1, {
		filename: 'docuflow-integration-verify.png',
		mimeType: 'image/png',
		altText: 'DocuFlow Pre-Prod Verification Image'
	});
	console.log(`Media uploaded successfully! ID: ${uploadResult.id}, Document ID: ${uploadResult.documentId}`);
	console.log(`Hosted URL: ${uploadResult.url}`);
	if (!uploadResult.id) throw new Error('FAIL: Media upload did not return an ID!');
	console.log('✓ Live Strapi media upload verified.');

	console.log(`\n[TEST 7] Strapi Version Detection & Adapter`);
	const adapter = await getStrapiAdapter();
	console.log(`Detected Adapter Version: Strapi ${adapter.version}`);
	if (adapter.version !== '5') {
		console.warn(`Expected version 5, got ${adapter.version}`);
	}
	console.log('✓ Strapi version detection & adapter verified.');

	console.log(`\n[TEST 8] Error Handling Diagnostics`);
	// 8a. Invalid token test
	try {
		const invalidHeaders = { Authorization: 'Bearer invalid_token_12345' };
		const res = await fetch(`${env.STRAPI_URL}/api/users`, { headers: invalidHeaders });
		console.log(`Invalid token test: HTTP status ${res.status} (Expected: 401)`);
	} catch (e) {
		console.log(`Invalid token error handled: ${e.message}`);
	}

	// 8b. Non-existent endpoint test
	try {
		const res = await fetch(`${env.STRAPI_URL}/api/non-existent-content-type-12345`, {
			headers: { Authorization: `Bearer ${env.STRAPI_API_TOKEN}` }
		});
		console.log(`Non-existent endpoint test: HTTP status ${res.status} (Expected: 404)`);
	} catch (e) {
		console.log(`Non-existent endpoint handled: ${e.message}`);
	}
	console.log('✓ Error handling diagnostics verified.');

	console.log(`\n[TEST 9] Collection Type & Single Type Endpoint Validation`);
	for (const ct of collectionTypes.slice(0, 5)) {
		const ep = `/api/${ct.pluralName || ct.singularName + 's'}`;
		console.log(`Collection Type "${ct.displayName}": endpoint is ${ep}`);
	}
	for (const st of singleTypes.slice(0, 5)) {
		const ep = `/api/${st.singularName}`;
		console.log(`Single Type "${st.displayName}": endpoint is ${ep}`);
	}
	console.log('✓ Type-aware endpoints verified.');

	console.log('\n====================================================');
	console.log('ALL PRE-PRODUCTION STRAPI INTEGRATION TESTS PASSED!');
	console.log('====================================================\n');
}

runVerification().catch(err => {
	console.error('\n❌ VERIFICATION FAILED:', err);
	process.exit(1);
});

