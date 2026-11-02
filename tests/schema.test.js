import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { loadSchemasFromFiles } from '../src/lib/server/schema/loader-files.js';
import { contentTypeToJsonSchema } from '../src/lib/server/schema/to-json-schema.js';
import { contentTypeToZod, validateContentData } from '../src/lib/server/schema/to-zod.js';
import { normalizeContentType } from '../src/lib/server/schema/normalize.js';

describe('Schema Engine', () => {
	const bundledPath = path.resolve('fixtures/schemas');
	const { contentTypes } = loadSchemasFromFiles(bundledPath);

	it('loads and normalizes the Service Page schema with components and dynamic zones', () => {
		const servicePage = contentTypes['api::service-page.service-page'];
		expect(servicePage).toBeDefined();
		expect(servicePage.singularName).toBe('service-page');
		expect(servicePage.draftAndPublish).toBe(true);

		// Check expanded repeatable component
		const servicesAttr = servicePage.attributes.services;
		expect(servicesAttr).toBeDefined();
		expect(servicesAttr.type).toBe('component');
		expect(servicesAttr.repeatable).toBe(true);
		expect(servicesAttr.schema).toBeDefined();
		expect(servicesAttr.schema.attributes.title).toBeDefined();
		expect(servicesAttr.schema.attributes.description).toBeDefined();

		// Check dynamic zone
		const sectionsAttr = servicePage.attributes.sections;
		expect(sectionsAttr).toBeDefined();
		expect(sectionsAttr.type).toBe('dynamiczone');
		expect(sectionsAttr.components).toContain('default.cta-banner');
		expect(sectionsAttr.schemas['default.cta-banner']).toBeDefined();
	});

	it('loads and normalizes a second content type (Article) without code changes', () => {
		const article = contentTypes['api::article.article'];
		expect(article).toBeDefined();
		expect(article.singularName).toBe('article');
		expect(article.attributes.title).toBeDefined();
		expect(article.attributes.body).toBeDefined();
		expect(article.attributes.status.enum).toEqual(['draft', 'review', 'published']);
	});

	it('excludes system fields (id, documentId, createdAt, etc.) from mappable attributes', () => {
		const rawWithSystem = {
			collectionName: 'test',
			attributes: {
				id: { type: 'integer' },
				documentId: { type: 'string' },
				createdAt: { type: 'datetime' },
				publishedAt: { type: 'datetime' },
				secretPassword: { type: 'password' },
				headline: { type: 'string', required: true }
			}
		};

		const normalized = normalizeContentType(rawWithSystem);
		expect(normalized.attributes.id).toBeUndefined();
		expect(normalized.attributes.documentId).toBeUndefined();
		expect(normalized.attributes.createdAt).toBeUndefined();
		expect(normalized.attributes.publishedAt).toBeUndefined();
		expect(normalized.attributes.secretPassword).toBeUndefined();
		expect(normalized.attributes.headline).toBeDefined();
	});

	it('prevents infinite recursion on circular component references', () => {
		const componentRegistry = {
			'test.node-a': {
				attributes: {
					name: { type: 'string' },
					child: { type: 'component', component: 'test.node-b' }
				}
			},
			'test.node-b': {
				attributes: {
					label: { type: 'string' },
					parent: { type: 'component', component: 'test.node-a' }
				}
			}
		};

		const rootContentType = {
			attributes: {
				tree: { type: 'component', component: 'test.node-a' }
			}
		};

		const normalized = normalizeContentType(rootContentType, componentRegistry);
		expect(normalized).toBeDefined();
		const treeAttr = normalized.attributes.tree;
		expect(treeAttr.schema).toBeDefined();
		// In node-b's schema, node-a reference should be marked manualOnly / cycle terminated
		const nodeB = treeAttr.schema.attributes.child.schema;
		expect(nodeB.attributes.parent.manualOnly).toBe(true);
	});

	it('generates Gemini JSON schema with structured output envelope', () => {
		const servicePage = contentTypes['api::service-page.service-page'];
		const jsonSchema = contentTypeToJsonSchema(servicePage, true);

		expect(jsonSchema.type).toBe('OBJECT');
		expect(jsonSchema.properties.data).toBeDefined();
		expect(jsonSchema.properties.fieldNotes).toBeDefined();
		expect(jsonSchema.properties.data.properties.title.type).toBe('STRING');
		expect(jsonSchema.properties.data.properties.services.type).toBe('ARRAY');
	});

	it('generates Zod schema and validates content data correctly', () => {
		const servicePage = contentTypes['api::service-page.service-page'];
		const zodSchema = contentTypeToZod(servicePage);

		const validData = {
			title: 'Enterprise Cloud',
			slug: 'enterprise-cloud',
			description: '<p>Cloud modernization services</p>',
			services: [
				{ title: 'Migration', description: 'Zero downtime' },
				{ title: 'Security', description: '24/7 SIEM' }
			]
		};

		const validRes = zodSchema.safeParse(validData);
		expect(validRes.success).toBe(true);

		// Missing required field
		const invalidRes = validateContentData(servicePage, {
			slug: 'missing-title-and-services'
		});
		expect(invalidRes.valid).toBe(false);
		expect(invalidRes.issues.some((iss) => iss.path.includes('title'))).toBe(true);
	});
});
