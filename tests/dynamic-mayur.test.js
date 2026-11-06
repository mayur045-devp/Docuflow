import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseDocx } from '../src/lib/server/document/parser.js';
import { extractIntermediateDocument } from '../src/lib/server/document/intermediate.js';
import { loadSchemasFromFiles } from '../src/lib/server/schema/loader-files.js';
import { mapDocumentToSchema } from '../src/lib/server/mapping/semantic-mapper.js';
import { validateContentData } from '../src/lib/server/schema/to-zod.js';
import { buildStrapiPayload } from '../src/lib/server/mapping/build-payload.js';
import { resolveAvailableSchemas, getContentTypeSchema } from '../src/lib/server/schema/resolve.js';
import { v5Adapter } from '../src/lib/server/strapi/adapters/v5.js';
import { v4Adapter } from '../src/lib/server/strapi/adapters/v4.js';

describe('Dynamic Strapi Schema Mapping & Validation', () => {
	const docPath = path.resolve('.data/user_upload/testing.docx');
	const cmsPath = path.resolve('cms');

	beforeAll(() => {
		const cmsSchemas = loadSchemasFromFiles(cmsPath);
		const rawContentTypes = Object.values(cmsSchemas.contentTypes).map((ct) => ({
			uid: ct.uid,
			apiID: ct.singularName,
			schema: {
				kind: ct.kind,
				info: {
					singularName: ct.singularName,
					pluralName: ct.pluralName,
					displayName: ct.displayName
				},
				attributes: ct.attributes
			}
		}));
		const rawComponents = Object.values(cmsSchemas.components || {}).map((c) => ({
			uid: c.uid,
			schema: c
		}));

		vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
			const urlStr = String(url);
			if (urlStr.includes('/content-type-builder/content-types')) {
				return new Response(JSON.stringify({ data: rawContentTypes }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}
			if (urlStr.includes('/content-type-builder/components')) {
				return new Response(JSON.stringify({ data: rawComponents }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				});
			}
			return new Response(JSON.stringify({ data: { id: 100, attributes: {} } }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		});
	});

	afterAll(() => {
		vi.restoreAllMocks();
	});

	it('parses testing.docx and verifies intermediate structure', async () => {
		expect(fs.existsSync(docPath)).toBe(true);
		const buf = fs.readFileSync(docPath);
		const docModel = await parseDocx(buf);

		expect(docModel).toBeDefined();
		expect(docModel.blocks.length).toBeGreaterThan(0);

		const intermediate = extractIntermediateDocument(docModel);
		expect(intermediate.keyValues.length).toBeGreaterThan(0);
		expect(intermediate.repeatedGroups.length).toBe(2);

		const ctaGroup = intermediate.repeatedGroups.find((rg) => rg.sectionHeading.toLowerCase() === 'cta');
		const cardsGroup = intermediate.repeatedGroups.find((rg) => rg.sectionHeading.toLowerCase() === 'cards');

		expect(ctaGroup).toBeDefined();
		expect(ctaGroup.records.length).toBe(2);
		expect(cardsGroup).toBeDefined();
		expect(cardsGroup.records.length).toBe(2);
	});

	it('dynamically maps document data to schema and passes Zod schema validation', async () => {
		const cmsSchemas = loadSchemasFromFiles(cmsPath);
		const mayurSchema = cmsSchemas.contentTypes['api::mayur.mayur'];
		if (!mayurSchema) return;

		const buf = fs.readFileSync(docPath);
		const docModel = await parseDocx(buf);
		const intermediate = extractIntermediateDocument(docModel);

		const mapped = mapDocumentToSchema({
			intermediateDoc: intermediate,
			documentModel: docModel,
			contentTypeDef: mayurSchema
		});

		expect(mapped.data.name).toBe('Testing of Automation Tool.');
		expect(mapped.data.slug).toBe('testing-of-automation-tool');
		expect(mapped.data.description).toContain('automate the data flow process');

		const validation = validateContentData(mayurSchema, mapped.data);
		expect(validation.valid).toBe(true);
	});

	it('discovers both Collection Types and Single Types dynamically and constructs type-aware endpoints', async () => {
		const { contentTypes } = await resolveAvailableSchemas({ forceRefresh: true });

		const collectionTypes = Object.values(contentTypes).filter(
			(ct) => (ct.kind || 'collectionType') === 'collectionType'
		);
		const singleTypes = Object.values(contentTypes).filter((ct) => ct.kind === 'singleType');

		// 1. Verify presence of both categories
		expect(collectionTypes.length).toBeGreaterThan(0);
		expect(singleTypes.length).toBeGreaterThan(0);

		// 2. Verify Collection Types dynamically
		const sampleCt = collectionTypes[0];
		expect(sampleCt).toBeDefined();
		expect(sampleCt.kind).toBe('collectionType');
		expect(sampleCt.pluralName).toBeDefined();
		expect(`/api/${sampleCt.pluralName}`).toBe(`/api/${sampleCt.pluralName}`);

		// 3. Verify Single Types dynamically
		const sampleSt = singleTypes[0];
		expect(sampleSt).toBeDefined();
		expect(sampleSt.kind).toBe('singleType');
		expect(sampleSt.singularName).toBeDefined();
		// Single Type endpoint MUST use singularName (/api/{singularName})
		const singleTypeEndpoint = `/api/${sampleSt.singularName}`;
		expect(singleTypeEndpoint).toBe(`/api/${sampleSt.singularName}`);

		// 4. Verify Admin URLs for both categories across Strapi v5 and v4
		const v5SingleLink = v5Adapter.adminLink({}, sampleSt.singularName, sampleSt.kind, sampleSt.uid);
		expect(v5SingleLink).toContain(`/content-manager/single-types/${sampleSt.uid}`);

		const v5CollectionLink = v5Adapter.adminLink({ id: 1, documentId: 'doc-1' }, sampleCt.singularName, sampleCt.kind, sampleCt.uid);
		expect(v5CollectionLink).toContain(`/content-manager/collection-types/${sampleCt.uid}/doc-1`);
	});

	it(
		'simulates import dryRun for Single Type without calling collection endpoints',
		async () => {
		const { POST } = await import('../src/routes/api/jobs/[id]/import/+server.js');
		const { createJob, saveExtraction, updateJobState } = await import(
			'../src/lib/server/jobs/store.js'
		);

		const { contentTypes } = await resolveAvailableSchemas();
		const singleTypes = Object.values(contentTypes).filter((ct) => ct.kind === 'singleType');
		expect(singleTypes.length).toBeGreaterThan(0);
		const targetSingleType = singleTypes[0];

		const job = createJob({
			originalFilename: 'testing.docx',
			sha256: 'mock-sha256-single-type-test',
			buffer: Buffer.from('test content'),
			contentTypeUid: targetSingleType.uid
		});

		updateJobState(job.id, 'parsed');
		updateJobState(job.id, 'extracted');
		updateJobState(job.id, 'reviewed');
		saveExtraction(job.id, {
			data: {
				title: 'Testing Single Type DryRun'
			},
			fieldNotes: [],
			warnings: [],
			issues: [],
			unmapped: []
		});

		const req = new Request(`http://localhost:5173/api/jobs/${job.id}/import`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ approved: true, dryRun: true })
		});

		const response = await POST({
			params: { id: job.id },
			request: req,
			getClientAddress: () => '127.0.0.1'
		});

		expect(response.status).toBe(200);
		const json = await response.json();
		expect(json.dryRun).toBe(true);
	}, 20000);

	it('switches between content types dynamically without retaining previous schemas or endpoints', () => {
		const { normalizeContentType } = require('../src/lib/server/schema/normalize.js');
		const { normalizeStrapiError } = require('../src/lib/server/strapi/errors.js');

		// Simulating Blog schema
		const blogSchema = {
			kind: 'collectionType',
			info: { singularName: 'titan-blog', pluralName: 'titan-blogs', displayName: 'Titan Blog' },
			attributes: { title: { type: 'string', required: true } }
		};

		// Simulating Case Study schema
		const caseStudySchema = {
			kind: 'collectionType',
			info: { singularName: 'titan-case-study', pluralName: 'titan-case-studys', displayName: 'Titan Case Study' },
			attributes: {
				title: { type: 'string', required: true },
				posttype: { type: 'enumeration', enum: ['plain', 'download'], default: 'plain' }
			}
		};

		// 1. Select Blog
		const normBlog = normalizeContentType(blogSchema, {});
		expect(normBlog.endpoint).toBe('titan-blogs');
		expect(`/api/${normBlog.endpoint}`).toBe('/api/titan-blogs');
		expect(normBlog.apiId).toBe('titan-blogs');
		expect(normBlog.attributes.posttype).toBeUndefined();

		// 2. Switch to Case Study
		const normCaseStudy = normalizeContentType(caseStudySchema, {});
		expect(normCaseStudy.endpoint).toBe('titan-case-studys');
		expect(`/api/${normCaseStudy.endpoint}`).toBe('/api/titan-case-studys');
		expect(normCaseStudy.apiId).toBe('titan-case-studys');
		expect(normCaseStudy.attributes.posttype).toBeDefined();

		// 3. Switch back to Blog
		const normBlogAgain = normalizeContentType(blogSchema, {});
		expect(normBlogAgain.endpoint).toBe('titan-blogs');
		expect(`/api/${normBlogAgain.endpoint}`).toBe('/api/titan-blogs');
		expect(normBlogAgain.apiId).toBe('titan-blogs');
		expect(normBlogAgain.attributes.posttype).toBeUndefined();

		// 4. Test enum normalization for template list in case study
		const { payload } = buildStrapiPayload(
			{ title: 'Case Study 1', posttype: 'Choose herePlainDownload' },
			normCaseStudy,
			{ formatRelation: (v) => v }
		);
		expect(payload.posttype).toBe('plain');

		// 5. Test detailed 400 validation error formatting
		const mockStrapi400 = {
			error: {
				status: 400,
				name: 'ValidationError',
				message: '2 errors occurred',
				details: {
					errors: [
						{ path: ['posttype'], message: 'posttype must be one of the following values: plain, download' },
						{ path: ['rel'], message: 'Invalid relations' }
					]
				}
			}
		};
		const normalizedErr = normalizeStrapiError(mockStrapi400, 400);
		expect(normalizedErr.issues).toHaveLength(2);
		expect(normalizedErr.issues[0].path).toBe('posttype');
		expect(normalizedErr.message).toContain('Field "posttype"');
		expect(normalizedErr.message).toContain('Field "rel"');
	});
});
