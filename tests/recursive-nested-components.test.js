import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseDocx } from '../src/lib/server/document/parser.js';
import { extractIntermediateDocument } from '../src/lib/server/document/intermediate.js';
import { mapDocumentToSchema } from '../src/lib/server/mapping/semantic-mapper.js';
import { normalizeContentType } from '../src/lib/server/schema/normalize.js';
import { validateContentData } from '../src/lib/server/schema/to-zod.js';
import { buildStrapiPayload } from '../src/lib/server/mapping/build-payload.js';

describe('Recursive Nested Strapi Component Mapping & Import', () => {
	const rawSaleSchema = JSON.parse(
		fs.readFileSync('cms/src/api/sale/content-types/sale/schema.json', 'utf8')
	);
	const components = {
		'hero.share-data': JSON.parse(
			fs.readFileSync('cms/src/components/hero/share-data.json', 'utf8')
		),
		'component.client-logos': JSON.parse(
			fs.readFileSync('cms/src/components/component/client-logos.json', 'utf8')
		),
		'component.seo': JSON.parse(
			fs.readFileSync('cms/src/components/component/seo.json', 'utf8')
		),
		'component.meta-social': JSON.parse(
			fs.readFileSync('cms/src/components/component/meta-social.json', 'utf8')
		)
	};
	const normSaleSchema = normalizeContentType(rawSaleSchema, components);

	it('maps EV Battery Safety Testing docx to api::sale.sale with nested repeatable metaSocial inside seo', async () => {
		const docxPath = path.resolve('.data/user_upload/EV_Battery_Safety_Testing_Content_Entry.docx');
		const buffer = fs.readFileSync(docxPath);
		const docModel = await parseDocx(buffer);
		const interDoc = extractIntermediateDocument(docModel);

		const mapped = mapDocumentToSchema({
			intermediateDoc: interDoc,
			documentModel: docModel,
			contentTypeDef: normSaleSchema
		});

		// 1. Top-level scalar fields
		expect(mapped.data.title).toContain('EV Battery Safety Testing');
		expect(mapped.data.slug).toBe('ev-battery-safety-testing-2026');
		expect(mapped.data.content).toBeDefined();

		// 2. Single component shareData
		expect(mapped.data.shareData).toBeDefined();
		expect(mapped.data.shareData.title).toContain('Share This Battery Testing');

		// 3. Repeatable component clientLogos
		expect(Array.isArray(mapped.data.clientLogos)).toBe(true);
		expect(mapped.data.clientLogos.length).toBe(3);

		// 4. Repeatable component seo with nested repeatable metaSocial
		expect(Array.isArray(mapped.data.seo)).toBe(true);
		expect(mapped.data.seo.length).toBe(1);

		const seo0 = mapped.data.seo[0];
		expect(seo0.metaTitle).toBe('How EV Battery Safety Testing Is Changing in 2026 | 12th Wonder');
		expect(seo0.metaDescription).toContain('Explore the shifts reshaping EV battery abuse testing');
		expect(typeof seo0.structureData).toBe('object');
		expect(seo0.structureData['@type']).toBe('Article');
		expect(seo0.keywords).toContain('EV battery');
		expect(seo0.metaRobots).toBe('index, follow');
		expect(seo0.metaViewPort).toBe('width=device-width, initial-scale=1');
		expect(seo0.canonicalURL).toBe('https://www.12thwonder.example/blog/ev-battery-safety-testing-2026');

		// 5. Nested repeatable component metaSocial
		expect(Array.isArray(seo0.metaSocial)).toBe(true);
		expect(seo0.metaSocial.length).toBe(2);

		const fb = seo0.metaSocial.find((m) => m.socialNetwork === 'Facebook');
		expect(fb).toBeDefined();
		expect(fb.title).toBe('EV Battery Safety Testing: What Is Changing in 2026');
		expect(fb.description).toContain('Earlier evidence, higher voltages');
		expect(fb.image).toBeDefined();

		const tw = seo0.metaSocial.find((m) => m.socialNetwork === 'Twitter');
		expect(tw).toBeDefined();
		expect(tw.title).toBe('Battery Safety Testing Is Moving Earlier');
		expect(tw.description).toContain('How validation teams are booking labs sooner');
		expect(tw.image).toBeDefined();

		// 6. No unmapped SEO or metaSocial fields
		const unmappedKeys = (mapped.unmapped || []).map((u) => u.text);
		expect(unmappedKeys.some((k) => k.includes('metaTitle'))).toBe(false);
		expect(unmappedKeys.some((k) => k.includes('metaSocial'))).toBe(false);
		expect(unmappedKeys.some((k) => k.includes('socialNetwork'))).toBe(false);

		// 7. Schema validation passes without errors
		const validation = validateContentData(normSaleSchema, mapped.data);
		expect(validation.valid).toBe(true);
		expect(validation.issues).toHaveLength(0);

		// 8. Payload builder formats Strapi payload recursively
		const fakeAdapter = { formatRelation: (v) => v };
		const { payload, warnings } = buildStrapiPayload(mapped.data, normSaleSchema, fakeAdapter);
		expect(Array.isArray(payload.seo)).toBe(true);
		expect(payload.seo.length).toBe(1);
		expect(Array.isArray(payload.seo[0].metaSocial)).toBe(true);
		expect(payload.seo[0].metaSocial.length).toBe(2);
		expect(payload.seo[0].metaSocial[0].socialNetwork).toBe('Facebook');
		expect(payload.seo[0].metaSocial[1].socialNetwork).toBe('Twitter');
		expect(warnings).toHaveLength(0);
	});

	it('handles single component containing repeatable component', () => {
		const singleSeoSchema = {
			kind: 'collectionType',
			attributes: {
				title: { type: 'string', required: true },
				seo: {
					type: 'component',
					repeatable: false,
					component: 'component.seo',
					schema: normSaleSchema.attributes.seo.schema
				}
			}
		};

		const interDoc = {
			keyValues: [
				{ rawKey: 'title', value: 'Test Page', sectionHeading: 'Main' },
				{ rawKey: 'metaTitle', value: 'Page SEO Title', sectionHeading: 'seo' }
			],
			repeatedGroups: [
				{
					sectionHeading: 'metaSocial',
					records: [
						{
							fields: { socialnetwork: 'Facebook', title: 'FB Title', description: 'FB Desc' },
							rawFields: { socialNetwork: 'Facebook', title: 'FB Title', description: 'FB Desc' }
						}
					]
				}
			],
			sections: []
		};

		const mapped = mapDocumentToSchema({
			intermediateDoc: interDoc,
			documentModel: { blocks: [], images: [] },
			contentTypeDef: singleSeoSchema
		});

		expect(mapped.data.title).toBe('Test Page');
		expect(typeof mapped.data.seo).toBe('object');
		expect(Array.isArray(mapped.data.seo)).toBe(false);
		expect(mapped.data.seo.metaTitle).toBe('Page SEO Title');
		expect(Array.isArray(mapped.data.seo.metaSocial)).toBe(true);
		expect(mapped.data.seo.metaSocial.length).toBe(1);
		expect(mapped.data.seo.metaSocial[0].socialNetwork).toBe('Facebook');
		expect(mapped.data.seo.metaSocial[0].title).toBe('FB Title');

		const validation = validateContentData(singleSeoSchema, mapped.data);
		expect(validation.valid).toBe(true);
	});

	it('handles 3-tier deep recursive component nesting (L1 -> L2 -> L3)', () => {
		const deepSchema = {
			kind: 'collectionType',
			attributes: {
				page: {
					type: 'component',
					repeatable: false,
					component: 'layout.page',
					schema: {
						attributes: {
							pageName: { type: 'string' },
							cards: {
								type: 'component',
								repeatable: true,
								component: 'layout.card',
								schema: {
									attributes: {
										cardTitle: { type: 'string' },
										actionBtn: {
											type: 'component',
											repeatable: false,
											component: 'layout.button',
											schema: {
												attributes: {
													label: { type: 'string' },
													url: { type: 'string' }
												}
											}
										}
									}
								}
							}
						}
					}
				}
			}
		};

		const interDoc = {
			keyValues: [
				{ rawKey: 'pageName', value: 'Landing Page', sectionHeading: 'page' }
			],
			repeatedGroups: [
				{
					sectionHeading: 'cards',
					records: [
						{
							fields: { cardtitle: 'Card A', 'actionbtn.label': 'Click Here', 'actionbtn.url': 'https://example.com/a' },
							rawFields: { cardTitle: 'Card A', 'actionBtn.label': 'Click Here', 'actionBtn.url': 'https://example.com/a' }
						},
						{
							fields: { cardtitle: 'Card B', 'actionbtn.label': 'Learn More', 'actionbtn.url': 'https://example.com/b' },
							rawFields: { cardTitle: 'Card B', 'actionBtn.label': 'Learn More', 'actionBtn.url': 'https://example.com/b' }
						}
					]
				}
			],
			sections: []
		};

		const mapped = mapDocumentToSchema({
			intermediateDoc: interDoc,
			documentModel: { blocks: [], images: [] },
			contentTypeDef: deepSchema
		});

		expect(mapped.data.page).toBeDefined();
		expect(mapped.data.page.pageName).toBe('Landing Page');
		expect(Array.isArray(mapped.data.page.cards)).toBe(true);
		expect(mapped.data.page.cards.length).toBe(2);
		expect(mapped.data.page.cards[0].cardTitle).toBe('Card A');
		expect(mapped.data.page.cards[0].actionBtn.label).toBe('Click Here');
		expect(mapped.data.page.cards[0].actionBtn.url).toBe('https://example.com/a');
		expect(mapped.data.page.cards[1].cardTitle).toBe('Card B');
		expect(mapped.data.page.cards[1].actionBtn.label).toBe('Learn More');

		const validation = validateContentData(deepSchema, mapped.data);
		expect(validation.valid).toBe(true);

		const fakeAdapter = { formatRelation: (v) => v };
		const { payload } = buildStrapiPayload(mapped.data, deepSchema, fakeAdapter);
		expect(payload.page.cards[0].actionBtn.label).toBe('Click Here');
	});
});
