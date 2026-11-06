import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseDocx } from '../src/lib/server/document/parser.js';
import { loadSchemasFromFiles } from '../src/lib/server/schema/loader-files.js';
import { extractHeuristics } from '../src/lib/server/ai/fallback-heuristic.js';
import { htmlToStrapiBlocks } from '../src/lib/server/mapping/blocks.js';
import { htmlToMarkdown } from '../src/lib/server/mapping/richtext.js';
import { generateSlug } from '../src/lib/server/mapping/slug.js';
import { buildStrapiPayload } from '../src/lib/server/mapping/build-payload.js';
import { v5Adapter } from '../src/lib/server/strapi/adapters/v5.js';

describe('AI and Mapping Engine', () => {
	const bundledPath = path.resolve('fixtures/schemas');
	const { contentTypes } = loadSchemasFromFiles(bundledPath);
	const servicePageSchema = contentTypes['api::service-page.service-page'];

	it('converts HTML to Strapi Blocks format accurately', () => {
		const html =
			'<h2>Headline</h2><p>Normal text with <strong>bold</strong> and <em>italic</em>.</p><ul><li>Item 1</li><li>Item 2</li></ul>';
		const blocks = htmlToStrapiBlocks(html);

		expect(blocks.length).toBe(3);
		expect(blocks[0].type).toBe('heading');
		expect(blocks[0].level).toBe(2);
		expect(blocks[0].children[0].text).toBe('Headline');

		expect(blocks[1].type).toBe('paragraph');
		const boldChild = blocks[1].children.find((c) => c.bold === true);
		expect(boldChild?.text).toBe('bold');

		expect(blocks[2].type).toBe('list');
		expect(blocks[2].format).toBe('unordered');
		expect(blocks[2].children.length).toBe(2);
	});

	it('converts HTML to Markdown for richtext attributes', () => {
		const html =
			'<p>Check out <a href="https://example.com">this link</a> and <strong>bold text</strong>.</p>';
		const md = htmlToMarkdown(html);
		expect(md).toContain('[this link](https://example.com)');
		expect(md).toContain('**bold text**');
	});

	it('generates clean URL slugs with transliteration', () => {
		expect(generateSlug('Héllo Wörld & Cloud 2026!')).toBe('hello-world-cloud-2026');
		expect(generateSlug('   Multiple   Spaces   -- Test  ')).toBe('multiple-spaces-test');
	});

	it('builds Strapi payload, whitelisting attributes and formatting blocks', () => {
		const rawReviewed = {
			title: 'Enterprise Services',
			slug: 'enterprise-services',
			description: '<p>High performance cloud solutions</p>',
			services: [{ title: 'Migration', description: 'Zero downtime' }],
			hallucinatedField: 'Should be stripped by whitelist'
		};

		const { payload } = buildStrapiPayload(rawReviewed, servicePageSchema, v5Adapter);

		expect(payload.title).toBe('Enterprise Services');
		expect(payload.hallucinatedField).toBeUndefined(); // Dropped by schema whitelist
		expect(Array.isArray(payload.description)).toBe(true); // Converted to Strapi blocks
		expect(payload.description[0].type).toBe('paragraph');
	});

	it('extracts Layout 1 (Standard Headings & Lists) correctly', async () => {
		const buf = fs.readFileSync(path.resolve('fixtures/docs/layout-1-standard.docx'));
		const docModel = await parseDocx(buf);
		const result = extractHeuristics({
			documentModel: docModel,
			contentTypeDef: servicePageSchema
		});

		expect(result.data.title).toBe('Cloud Migration & Modernization Services');
		expect(result.data.services.length).toBeGreaterThanOrEqual(3);
		expect(result.data.faqs.length).toBeGreaterThanOrEqual(2);
		expect(result.data.slug).toBe('cloud-migration-modernization-services');
	});

	it('extracts Layout 2 (Fake Headings) correctly', async () => {
		const buf = fs.readFileSync(path.resolve('fixtures/docs/layout-2-fake-headings.docx'));
		const docModel = await parseDocx(buf);
		const result = extractHeuristics({
			documentModel: docModel,
			contentTypeDef: servicePageSchema
		});

		expect(result.data.title).toBe('CYBERSECURITY OPERATIONS');
		expect(result.data.services.length).toBeGreaterThanOrEqual(2);
	});

	it('extracts Layout 3 (Tables & Q&A) correctly', async () => {
		const buf = fs.readFileSync(path.resolve('fixtures/docs/layout-3-tables-qa.docx'));
		const docModel = await parseDocx(buf);
		const result = extractHeuristics({
			documentModel: docModel,
			contentTypeDef: servicePageSchema
		});

		expect(result.data.title).toBe('Data Engineering & Analytics');
		expect(result.data.services.length).toBeGreaterThanOrEqual(2);
		expect(result.data.faqs.length).toBeGreaterThanOrEqual(2);
		expect(result.data.faqs[0].question).toContain('database technologies');
	});

	it('extracts Layout 4 (Synonyms "Our Expertise") correctly', async () => {
		const buf = fs.readFileSync(path.resolve('fixtures/docs/layout-4-synonyms.docx'));
		const docModel = await parseDocx(buf);
		const result = extractHeuristics({
			documentModel: docModel,
			contentTypeDef: servicePageSchema
		});

		expect(result.data.title).toBe('Enterprise AI & Machine Learning');
		expect(result.data.services.length).toBeGreaterThanOrEqual(2);
	});

	it('extracts Layout 5 (Cover Image + Missing FAQs) and emits warnings', async () => {
		const buf = fs.readFileSync(path.resolve('fixtures/docs/layout-5-images-missing.docx'));
		const docModel = await parseDocx(buf);
		const result = extractHeuristics({
			documentModel: docModel,
			contentTypeDef: servicePageSchema
		});

		expect(result.data.title).toBe('Mobile App Engineering');
		expect(result.data.coverImage).toBe('img-1');
		// FAQs is empty, no hallucinated content
		expect(result.data.faqs).toEqual([]);
	});

	it('treats prompt injection attempt as untrusted plain text', async () => {
		const buf = fs.readFileSync(path.resolve('fixtures/docs/prompt-injection.docx'));
		const docModel = await parseDocx(buf);
		const result = extractHeuristics({
			documentModel: docModel,
			contentTypeDef: servicePageSchema
		});

		expect(result.data.title).toContain('SYSTEM OVERRIDE');
		// Verify schema validation and safe structure remained intact
		expect(result.data.services).toBeDefined();
	});

	it('Scenario A: ignores extra content not in schema and lists in unmapped', () => {
		const rawWithExtra = {
			title: 'Enterprise Services',
			slug: 'enterprise-services',
			additionalNotes: 'Confidential client remarks',
			references: 'ISO 27001 standard docs',
			contactInfo: 'support@example.com'
		};

		const { payload } = buildStrapiPayload(rawWithExtra, servicePageSchema, v5Adapter);

		// Only supported schema attributes exist in payload
		expect(payload.title).toBe('Enterprise Services');
		expect(payload.additionalNotes).toBeUndefined();
		expect(payload.references).toBeUndefined();
		expect(payload.contactInfo).toBeUndefined();
	});

	it('Scenario B: keeps missing optional fields clean and empty without fake data', () => {
		const articleSchema = contentTypes['api::article.article'];
		const minimalDocData = {
			title: 'Minimal Document Article',
			slug: 'minimal-document-article'
		};

		const { payload, warnings } = buildStrapiPayload(minimalDocData, articleSchema, v5Adapter);

		expect(payload.title).toBe('Minimal Document Article');
		expect(payload.slug).toBe('minimal-document-article');
		// Missing optional fields are populated with correct typed empty clearing value (null / []), not fake data
		expect(payload.body).toBeNull();
		expect(payload.summary).toBeNull();
		expect(payload.authorName).toBeNull();
		expect(payload.featuredImage).toBeNull();
		// No warnings for optional missing fields
		expect(warnings).toEqual([]);
	});

	it('maps complex Blog collection with single components, repeatables, and media', async () => {
		const blogPath = path.resolve('.data/jobs/5c2a2833-28fb-4988-a1b7-3a3223fc2046/source.docx');
		if (fs.existsSync(blogPath)) {
			const { loadSchemasFromFiles: loadCmsSchemas } = await import(
				'../src/lib/server/schema/loader-files.js'
			);
			const cmsSchemas = loadCmsSchemas(path.resolve('cms'));
			const blogSchema = cmsSchemas.contentTypes['api::blog.blog'];

			if (blogSchema) {
				const buf = fs.readFileSync(blogPath);
				const docModel = await parseDocx(buf);
				const result = extractHeuristics({
					documentModel: docModel,
					contentTypeDef: blogSchema
				});

				// Top-level scalar fields
				expect(result.data.title).toBe(
					'Booking a Third-Party Test Lab: What to Send and What to Expect'
				);
				expect(result.data.description).toContain('signatories of the international');
				expect(result.data.coverImage).toBe('img-1');
				expect(result.data.date).toBe('2026-10-28');
				expect(result.data.buttonTitle).toBe('Simplify Third-Party Lab Bookings');
				expect(result.data.buttonSubtitle).toContain('Connect test requests');
				expect(result.data.Time).toBe('7 min read');

				// Single component: seo
				expect(result.data.seo).toBeDefined();
				expect(result.data.seo.metaTitle).toContain('Booking a Third-Party Test Lab');
				expect(result.data.seo.keywords).toContain('Mayur');
				expect(result.data.seo.shareImage).toBe('img-2');
				expect(typeof result.data.seo.structureData).toBe('object');

				// Single component: AuthorData
				expect(result.data.AuthorData).toBeDefined();
				expect(result.data.AuthorData.AuthorName).toBe('Neerav Singh');
				expect(result.data.AuthorData.Authordesignation).toBe('Technical Specilist');
				expect(result.data.AuthorData.AuthorImage).toBe('img-3');

				// Repeatable component: contentNew
				expect(Array.isArray(result.data.contentNew)).toBe(true);
				expect(result.data.contentNew.length).toBe(2);
				expect(result.data.contentNew[0].title).toBe('Choosing the lab');
				expect(result.data.contentNew[0].content).toContain('Start with the accreditation scope');
				expect(result.data.contentNew[1].title).toBe('The first request');

				// Extra content correctly unmapped
				expect(result.unmapped.length).toBeGreaterThan(0);
			}
		}
	});

	it('adapts to dynamic schema changes without application code modifications', async () => {
		// Clone servicePageSchema and add a newly created custom field 'guaranteeTerms'
		const dynamicSchema = JSON.parse(JSON.stringify(servicePageSchema));
		dynamicSchema.attributes.guaranteeTerms = {
			name: 'guaranteeTerms',
			type: 'string',
			required: false
		};

		const { mapDocumentToSchema } = await import(
			'../src/lib/server/mapping/semantic-mapper.js'
		);

		// Intermediate doc containing the new field
		const intermediate = {
			sections: [],
			keyValues: [
				{
					key: 'guaranteeterms',
					rawKey: 'Guarantee Terms',
					value: '100% money back within 30 days',
					sectionHeading: 'Terms'
				}
			],
			repeatedGroups: [],
			images: [],
			fullMarkdown: ''
		};

		const result = mapDocumentToSchema({
			intermediateDoc: intermediate,
			documentModel: /** @type {any} */ ({ blocks: [], images: [], hints: [] }),
			contentTypeDef: dynamicSchema
		});

		expect(result.data.guaranteeTerms).toBe('100% money back within 30 days');
	});
});
