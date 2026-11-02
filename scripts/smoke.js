import fs from 'node:fs';
import path from 'node:path';
import { startMockServer } from './mock-strapi.js';
import { validateDocx } from '../src/lib/server/security/docx-guard.js';
import { parseDocx } from '../src/lib/server/document/parser.js';
import {
	createJob,
	saveParsedDocument,
	saveExtraction,
	saveReview,
	updateJobState
} from '../src/lib/server/jobs/store.js';
import { loadSchemasFromFiles } from '../src/lib/server/schema/loader-files.js';
import { extractHeuristics } from '../src/lib/server/ai/fallback-heuristic.js';
import { validateContentData } from '../src/lib/server/schema/to-zod.js';
import { v4Adapter } from '../src/lib/server/strapi/adapters/v4.js';
import { v5Adapter } from '../src/lib/server/strapi/adapters/v5.js';
import { buildStrapiPayload } from '../src/lib/server/mapping/build-payload.js';

const MOCK_PORT = 1338;
let mockServer;

async function runSmokeTests() {
	console.log('\n=============================================');
	console.log('       DocuFlow End-to-End Smoke Test        ');
	console.log('=============================================\n');

	// Set test env
	process.env.STRAPI_URL = `http://localhost:${MOCK_PORT}`;
	process.env.STRAPI_API_TOKEN = 'mock-strapi-token-12345';
	process.env.DATA_DIR = '.data/smoke-test';
	process.env.APP_PASSWORD = 'docuflow-secret-password-123';
	process.env.SESSION_SECRET = 'dev_session_secret_key_at_least_32_characters_long_123456';

	mockServer = await startMockServer(MOCK_PORT, '5');

	const { contentTypes } = loadSchemasFromFiles(path.resolve('fixtures/schemas'));
	const servicePageSchema = contentTypes['api::service-page.service-page'];
	if (!servicePageSchema) {
		throw new Error('Service page schema could not be loaded');
	}

	const fixtures = [
		{ file: 'layout-1-standard.docx', name: 'Layout 1: Standard Headings & Lists' },
		{ file: 'layout-2-fake-headings.docx', name: 'Layout 2: Fake Headings (Bold/ALL-CAPS)' },
		{ file: 'layout-3-tables-qa.docx', name: 'Layout 3: Tables & Q&A Lines' },
		{ file: 'layout-4-synonyms.docx', name: 'Layout 4: Synonyms ("Our Expertise")' },
		{ file: 'layout-5-images-missing.docx', name: 'Layout 5: Embedded Images & Missing Section' }
	];

	// Test both Strapi 5 and Strapi 4
	for (const version of ['5', '4']) {
		console.log(`\n>>> Testing Strapi version ${version} pipeline <<<`);

		// Switch mock server version
		await fetch(`http://localhost:${MOCK_PORT}/mock/version`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ version })
		});

		const adapter = version === '4' ? v4Adapter : v5Adapter;

		for (const fixture of fixtures) {
			const filePath = path.resolve('fixtures/docs', fixture.file);
			if (!fs.existsSync(filePath)) {
				throw new Error(`Fixture file not found: ${filePath}. Run npm run fixtures first.`);
			}

			const buffer = fs.readFileSync(filePath);

			// 1. Guard check
			const guard = await validateDocx(buffer, fixture.file);
			if (!guard.sha256) throw new Error('Guard check failed');

			// 2. Parse DOCX
			const docModel = await parseDocx(buffer);
			if (docModel.blocks.length === 0) throw new Error('Document has 0 blocks');

			// 3. Create Job
			const job = createJob({
				originalFilename: guard.sanitizedFilename,
				sha256: guard.sha256,
				buffer,
				contentTypeUid: servicePageSchema.uid
			});
			saveParsedDocument(job.id, docModel);
			updateJobState(job.id, 'parsed');

			// 4. Extract (heuristic / mock)
			const extraction = extractHeuristics({
				documentModel: docModel,
				contentTypeDef: servicePageSchema
			});
			saveExtraction(job.id, extraction);
			updateJobState(job.id, 'extracted');

			// 5. Review & Revalidate
			const validation = validateContentData(servicePageSchema, extraction.data);
			saveReview(job.id, extraction.data, validation.issues, true);
			updateJobState(job.id, 'reviewed', { approved: true });

			// 6. Build Payload
			const { payload } = buildStrapiPayload(extraction.data, servicePageSchema, adapter);

			// 7. Import Draft into Mock Strapi
			updateJobState(job.id, 'importing');
			const endpoint = servicePageSchema.pluralName || 'service-pages';
			const createdEntry = await adapter.create(endpoint, payload, { draft: true });

			if (!createdEntry || !createdEntry.id) {
				throw new Error(`Draft creation failed for ${fixture.name}`);
			}

			if (version === '5') {
				if (!createdEntry.documentId) {
					throw new Error('Strapi 5 entry missing documentId');
				}
			} else {
				if (createdEntry.attributes.publishedAt !== null) {
					throw new Error('Strapi 4 entry is not a draft (publishedAt is not null)');
				}
			}

			updateJobState(job.id, 'imported', {
				strapiEntryId: createdEntry.id,
				strapiDocumentId: createdEntry.documentId
			});

			console.log(
				`  ✓ ${fixture.name} -> Imported as Draft #${createdEntry.id} (${version === '5' ? createdEntry.documentId : 'v4-draft'})`
			);
		}
	}

	console.log('\n=============================================');
	console.log('   All 5 Fixtures Passed on Strapi 4 & 5!    ');
	console.log('=============================================\n');

	if (mockServer) {
		mockServer.close();
	}
}

runSmokeTests().catch((err) => {
	console.error('\nSmoke test failure:', err);
	if (mockServer) mockServer.close();
	process.exit(1);
});
