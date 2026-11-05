import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { v4Adapter } from '../src/lib/server/strapi/adapters/v4.js';
import { v5Adapter } from '../src/lib/server/strapi/adapters/v5.js';
import { normalizeStrapiError } from '../src/lib/server/strapi/errors.js';

let currentVersion = '5';
const mockDb = new Map();

describe('Strapi Client and Adapters', () => {
	beforeAll(() => {
		process.env.STRAPI_URL = 'https://strapi-preprod.12thwonder.com';
		process.env.STRAPI_API_TOKEN = 'mock-strapi-token-12345';

		// In-process fetch mock so tests run cleanly both inside and outside sandbox
		vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init = {}) => {
			const urlStr = String(url);
			const method = init.method || 'GET';
			const body = init.body ? JSON.parse(String(init.body)) : {};

			if (urlStr.includes('/api/service-pages')) {
				if (method === 'POST') {
					const id = mockDb.size + 1;
					const docId = `doc-sp-${id}`;
					const isV5Draft = urlStr.includes('status=draft');
					const isV4Draft = body.data?.publishedAt === null;

					const entry = {
						id,
						documentId: docId,
						...body.data,
						publishedAt: isV5Draft || isV4Draft ? null : new Date().toISOString()
					};
					mockDb.set(id, entry);

					let resData;
					if (currentVersion === '4') {
						const { id: eId, attributes: attrs } = {
							id: entry.id,
							attributes: {
								title: entry.title,
								slug: entry.slug,
								description: entry.description,
								publishedAt: entry.publishedAt
							}
						};
						resData = { id: eId, attributes: attrs };
					} else {
						resData = entry;
					}

					return new Response(JSON.stringify({ data: resData }), {
						status: 201,
						headers: { 'Content-Type': 'application/json' }
					});
				}
			}

			if (urlStr.includes('/api/mayur')) {
				if (method === 'PUT') {
					const id = 100;
					const docId = 'doc-mayur-100';
					const isV5Draft = urlStr.includes('status=draft');
					const isV4Draft = body.data?.publishedAt === null;

					const entry = {
						id,
						documentId: docId,
						...body.data,
						publishedAt: isV5Draft || isV4Draft ? null : new Date().toISOString()
					};

					let resData;
					if (currentVersion === '4') {
						resData = { id: entry.id, attributes: { ...body.data, publishedAt: entry.publishedAt } };
					} else {
						resData = entry;
					}

					return new Response(JSON.stringify({ data: resData }), {
						status: 200,
						headers: { 'Content-Type': 'application/json' }
					});
				}
			}

			return new Response(JSON.stringify({ data: [] }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		});
	});

	afterAll(() => {
		vi.restoreAllMocks();
	});

	it('creates and normalizes draft entries in Strapi 5 mode', async () => {
		currentVersion = '5';

		const result = await v5Adapter.create('service-pages', {
			title: 'V5 Service Page',
			slug: 'v5-service-page',
			description: 'Description content'
		});

		expect(result).toBeDefined();
		expect(result.id).toBeDefined();
		expect(result.documentId).toMatch(/^doc-sp-/);
		expect(result.attributes.title).toBe('V5 Service Page');
		expect(result.attributes.slug).toBe('v5-service-page');
	});

	it('creates and normalizes draft entries in Strapi 4 mode', async () => {
		currentVersion = '4';

		const result = await v4Adapter.create('service-pages', {
			title: 'V4 Service Page',
			slug: 'v4-service-page',
			description: 'Description content'
		});

		expect(result).toBeDefined();
		expect(result.id).toBeDefined();
		expect(result.documentId).toBeNull();
		expect(result.attributes.title).toBe('V4 Service Page');
		expect(result.attributes.publishedAt).toBeNull(); // Verifies draft status in v4
	});

	it('formats relations according to Strapi version specifications', () => {
		// Strapi 4: { connect: [id] }
		const v4Rel = v4Adapter.formatRelation(42);
		expect(v4Rel).toEqual({ connect: [42] });

		// Strapi 5: { connect: [{ documentId: "doc-42" }] }
		const v5Rel = v5Adapter.formatRelation({ documentId: 'doc-42' });
		expect(v5Rel).toEqual({ connect: [{ documentId: 'doc-42' }] });
	});

	it('creates and updates Single Type entries via PUT in Strapi 5 mode', async () => {
		currentVersion = '5';

		const result = await v5Adapter.create(
			'mayur',
			{ name: 'Testing of Automation Tool.' },
			{ draft: true, isSingleType: true }
		);

		expect(result).toBeDefined();
		expect(result.id).toBe(100);
		expect(result.documentId).toBe('doc-mayur-100');
		expect(result.attributes.name).toBe('Testing of Automation Tool.');
	});

	it('creates and updates Single Type entries via PUT in Strapi 4 mode', async () => {
		currentVersion = '4';

		const result = await v4Adapter.create(
			'mayur',
			{ name: 'Testing of Automation Tool.' },
			{ draft: true, isSingleType: true }
		);

		expect(result).toBeDefined();
		expect(result.id).toBe(100);
		expect(result.attributes.name).toBe('Testing of Automation Tool.');
		expect(result.attributes.publishedAt).toBeNull();
	});

	it('normalizes Strapi validation errors with field paths', () => {
		const rawError = {
			error: {
				name: 'ValidationError',
				message: 'Invalid payload',
				details: {
					errors: [
						{ path: ['services', '0', 'title'], message: 'title is a required field' },
						{ path: ['slug'], message: 'slug must be unique' }
					]
				}
			}
		};

		const normalized = normalizeStrapiError(rawError, 400);
		expect(normalized.code).toBe('ValidationError');
		expect(normalized.issues.length).toBe(2);
		expect(normalized.issues[0].path).toBe('services.0.title');
		expect(normalized.issues[1].path).toBe('slug');
	});
});
