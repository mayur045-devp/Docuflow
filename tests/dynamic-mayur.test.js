import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseDocx } from '../src/lib/server/document/parser.js';
import { extractIntermediateDocument } from '../src/lib/server/document/intermediate.js';
import { loadSchemasFromFiles } from '../src/lib/server/schema/loader-files.js';
import { mapDocumentToSchema } from '../src/lib/server/mapping/semantic-mapper.js';
import { validateContentData } from '../src/lib/server/schema/to-zod.js';
import { buildStrapiPayload } from '../src/lib/server/mapping/build-payload.js';
import { resolveAvailableSchemas } from '../src/lib/server/schema/resolve.js';
import { v5Adapter } from '../src/lib/server/strapi/adapters/v5.js';
import { v4Adapter } from '../src/lib/server/strapi/adapters/v4.js';

describe('Dynamic Strapi Schema Mapping & Validation (api::mayur.mayur)', () => {
	const docPath = path.resolve('.data/user_upload/testing.docx');
	const cmsPath = path.resolve('cms');

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

	it('dynamically maps document data to api::mayur.mayur schema and passes Zod schema validation', async () => {
		const cmsSchemas = loadSchemasFromFiles(cmsPath);
		const mayurSchema = cmsSchemas.contentTypes['api::mayur.mayur'];

		expect(mayurSchema).toBeDefined();
		expect(mayurSchema.kind).toBe('singleType');
		expect(mayurSchema.singularName).toBe('mayur');

		const buf = fs.readFileSync(docPath);
		const docModel = await parseDocx(buf);
		const intermediate = extractIntermediateDocument(docModel);

		const result = mapDocumentToSchema({
			intermediateDoc: intermediate,
			documentModel: docModel,
			contentTypeDef: mayurSchema
		});

		// 1. Top-level scalar and multiple media fields
		expect(result.data.name).toBe('Testing of Automation Tool.');
		expect(result.data.description).toContain('A complete system to automate the data flow');
		expect(result.data.slug).toBe('testing-of-automation-tool');
		expect(result.data.CardTitle).toBe('Why Teams Choose Structured Lab Booking');
		expect(Array.isArray(result.data.thumbnailImages)).toBe(true);
		expect(result.data.thumbnailImages).toEqual(['img-4', 'img-5', 'img-6']);

		// 2. Single Component: HeroSection
		expect(result.data.HeroSection).toBeDefined();
		expect(result.data.HeroSection.title).toBe('Book Third-Party Test Labs Without the Back-and-Forth');
		expect(result.data.HeroSection.subtitle).toContain('Send complete test requests');
		expect(result.data.HeroSection.coverImage).toBe('img-1');

		// 3. Single Component: Banner with nested button component and exact-case Image field
		expect(result.data.Banner).toBeDefined();
		expect(result.data.Banner.title).toBe('Ready to Simplify Your Lab Bookings?');
		expect(result.data.Banner.description).toContain('Connect test requests');
		expect(result.data.Banner.button).toBeDefined();
		expect(result.data.Banner.button.name).toBe('Talk to Our Team');
		expect(result.data.Banner.button.link).toBe('/contact-us');
		expect(result.data.Banner.Image).toBe('img-7');

		// 4. Repeatable Component: cta (2 entries with nested button component)
		expect(Array.isArray(result.data.cta)).toBe(true);
		expect(result.data.cta.length).toBe(2);

		expect(result.data.cta[0].title).toBe('Request a Test Lab Quote');
		expect(result.data.cta[0].description).toContain('Share your device details');
		expect(result.data.cta[0].button).toEqual({
			name: 'Request a Quote',
			link: '/request-quote'
		});
		expect(result.data.cta[0].image).toBe('img-2');

		expect(result.data.cta[1].title).toBe('See the Booking Workflow');
		expect(result.data.cta[1].description).toContain('Walk through intake');
		expect(result.data.cta[1].button).toEqual({
			name: 'Request Demo',
			link: '/request-demo'
		});
		expect(result.data.cta[1].image).toBe('img-3');

		// 5. Repeatable Component: cards (2 entries with multiple media array and nested Links component)
		expect(Array.isArray(result.data.cards)).toBe(true);
		expect(result.data.cards.length).toBe(2);

		expect(result.data.cards[0].title).toBe('Faster Booking Confirmation');
		expect(result.data.cards[0].description).toContain('Structured intake fields');
		expect(result.data.cards[0].media).toEqual(['img-8', 'img-9']);
		expect(result.data.cards[0].Links).toEqual({
			name: 'Read More',
			link: '/blog/booking-a-third-party-test-lab'
		});

		expect(result.data.cards[1].title).toBe('Complete Traceability');
		expect(result.data.cards[1].description).toContain('Samples, design levels');
		expect(result.data.cards[1].media).toEqual(['img-10', 'img-11']);
		expect(result.data.cards[1].Links).toEqual({
			name: 'Learn More',
			link: '/features/traceability'
		});

		// 6. Schema Validation (Fixing "Data failed schema validation")
		const validation = validateContentData(mayurSchema, result.data);
		expect(validation.valid).toBe(true);
		expect(validation.issues).toEqual([]);

		// 7. Payload generation for Strapi
		const { payload, warnings } = buildStrapiPayload(result.data, mayurSchema, v5Adapter);
		expect(warnings).toEqual([]);
		expect(payload.name).toBe('Testing of Automation Tool.');
		expect(payload.slug).toBe('testing-of-automation-tool');
		expect(payload.Banner.button.name).toBe('Talk to Our Team');
		expect(payload.cta[0].button.name).toBe('Request a Quote');
		expect(payload.cards[0].Links.name).toBe('Read More');

		// 8. Single-type Admin link generation
		const adminLink = v5Adapter.adminLink(payload, mayurSchema.singularName, mayurSchema.kind);
		expect(adminLink).toContain('/content-manager/single-types/api::mayur.mayur');
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

		// 2. Verify Collection Types
		const articleCt = collectionTypes.find((c) => c.displayName === 'Article');
		const blogCt = collectionTypes.find((c) => c.displayName === 'Blog');
		const pollCt = collectionTypes.find((c) => c.displayName === 'Poll');
		const userCt = collectionTypes.find((c) => c.displayName === 'User');

		expect(articleCt).toBeDefined();
		expect(articleCt.kind).toBe('collectionType');
		expect(articleCt.pluralName).toBe('articles');
		expect(`/api/${articleCt.pluralName}`).toBe('/api/articles');

		expect(blogCt).toBeDefined();
		expect(blogCt.kind).toBe('collectionType');
		expect(blogCt.pluralName).toBe('blogs');
		expect(`/api/${blogCt.pluralName}`).toBe('/api/blogs');

		expect(pollCt).toBeDefined();
		expect(pollCt.kind).toBe('collectionType');
		expect(pollCt.pluralName).toBe('polls');
		expect(`/api/${pollCt.pluralName}`).toBe('/api/polls');

		expect(userCt).toBeDefined();
		expect(userCt.kind).toBe('collectionType');
		expect(userCt.pluralName).toBe('users');
		expect(`/api/${userCt.pluralName}`).toBe('/api/users');

		// 3. Verify Single Types
		const mayurSt = singleTypes.find((s) => s.displayName === 'Mayurs' || s.singularName === 'mayur');
		expect(mayurSt).toBeDefined();
		expect(mayurSt.kind).toBe('singleType');
		expect(mayurSt.singularName).toBe('mayur');
		// Single Type endpoint MUST use singularName (/api/mayur), NOT pluralName (/api/mayurs)
		const singleTypeEndpoint = `/api/${mayurSt.singularName}`;
		expect(singleTypeEndpoint).toBe('/api/mayur');

		// Verify newly created Single Type abcd
		const abcdSt = singleTypes.find((s) => s.displayName === 'abcd' || s.singularName === 'abcd');
		if (abcdSt) {
			expect(abcdSt.kind).toBe('singleType');
			expect(abcdSt.singularName).toBe('abcd');
			expect(`/api/${abcdSt.singularName}`).toBe('/api/abcd');
			// Ensure abcd is NOT in collectionTypes
			expect(collectionTypes.some((c) => c.singularName === 'abcd')).toBe(false);
		}

		// Ensure Mayurs is NOT in collectionTypes
		expect(collectionTypes.some((c) => c.singularName === 'mayur')).toBe(false);

		// 4. Verify Admin URLs for both categories across Strapi v5 and v4
		const v5SingleLink = v5Adapter.adminLink({}, mayurSt.singularName, mayurSt.kind, mayurSt.uid);
		expect(v5SingleLink).toContain('/content-manager/single-types/api::mayur.mayur');

		const v4SingleLink = v4Adapter.adminLink({}, mayurSt.singularName, mayurSt.kind, mayurSt.uid);
		expect(v4SingleLink).toContain('/content-manager/singleType/api::mayur.mayur');

		const v5CollectionLink = v5Adapter.adminLink({ id: 1, documentId: 'doc-1' }, blogCt.singularName, blogCt.kind, blogCt.uid);
		expect(v5CollectionLink).toContain('/content-manager/collection-types/api::blog.blog/doc-1');

		const v4CollectionLink = v4Adapter.adminLink({ id: 1 }, blogCt.singularName, blogCt.kind, blogCt.uid);
		expect(v4CollectionLink).toContain('/content-manager/collectionType/api::blog.blog/1');
	});

	it('simulates import dryRun for Single Type without calling collection endpoints', async () => {
		const { POST } = await import('../src/routes/api/jobs/[id]/import/+server.js');
		const { createJob, saveExtraction, updateJobState } = await import(
			'../src/lib/server/jobs/store.js'
		);

		const job = createJob({
			originalFilename: 'testing.docx',
			sha256: 'mock-sha256-single-type-test',
			buffer: Buffer.from('test content'),
			contentTypeUid: 'api::mayur.mayur'
		});

		updateJobState(job.id, 'parsed');
		updateJobState(job.id, 'extracted');
		updateJobState(job.id, 'reviewed');
		saveExtraction(job.id, {
			data: {
				name: 'Testing of Automation Tool.',
				description: '<p>A complete system</p>',
				slug: 'testing-of-automation-tool',
				HeroSection: {
					title: 'Book Third-Party Test Labs Without the Back-and-Forth',
					subtitle: 'Send complete test requests'
				}
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
		expect(json.payload.name).toBe('Testing of Automation Tool.');
		expect(json.payload.slug).toBe('testing-of-automation-tool');
	});
});

