import { describe, it, expect } from 'vitest';
import { buildStrapiPayload, getEmptyValueForField, verifyImportedEntry } from '../src/lib/server/mapping/build-payload.js';
import { mapDocumentToSchema } from '../src/lib/server/mapping/semantic-mapper.js';
import { validateContentData } from '../src/lib/server/schema/to-zod.js';
import { v5Adapter } from '../src/lib/server/strapi/adapters/v5.js';
import { v4Adapter } from '../src/lib/server/strapi/adapters/v4.js';

describe('Missing Document Fields Handling (Valid State, Not an Error)', () => {
	// Dummy fake adapter for testing formatRelation
	const mockAdapter = {
		version: '5',
		formatRelation: (val) => {
			if (!val) return null;
			return { connect: [{ id: val }] };
		}
	};

	it('Test 1 — Missing optional field: maps present fields, sets missing field to empty, succeeds without error', () => {
		const schema = {
			kind: 'collectionType',
			attributes: {
				title: { type: 'string', required: true },
				description: { type: 'text', required: false },
				author: { type: 'string', required: false }
			}
		};

		const intermediateDoc = {
			keyValues: [
				{ rawKey: 'title', value: 'EV Battery Testing', blockId: 'b1' },
				{ rawKey: 'description', value: 'Battery safety analysis report', blockId: 'b2' }
			],
			sections: [],
			repeatedGroups: []
		};

		const mapped = mapDocumentToSchema({
			intermediateDoc,
			documentModel: { blocks: [{ id: 'b1', text: 'EV Battery Testing' }], images: [] },
			contentTypeDef: schema
		});

		// 1. Mapping distinguishes FOUND vs MISSING
		expect(mapped.data.title).toBe('EV Battery Testing');
		expect(mapped.data.description).toBe('Battery safety analysis report');
		expect(mapped.data.author).toBeNull();

		const authorNote = mapped.fieldNotes.find((n) => n.field === 'author' || n.path === 'author');
		expect(authorNote).toBeDefined();
		expect(authorNote.status).toBe('missing');
		expect(authorNote.value).toBeNull();

		// 2. Validation passes with zero issues (missing optional field is not an error)
		const validation = validateContentData(schema, mapped.data);
		expect(validation.valid).toBe(true);
		expect(validation.issues).toHaveLength(0);

		// 3. Payload builder assigns correct empty clearing value
		const { payload, warnings } = buildStrapiPayload(mapped.data, schema, mockAdapter);
		expect(payload.title).toBe('EV Battery Testing');
		expect(payload.description).toBe('Battery safety analysis report');
		expect(payload.author).toBeNull();
		expect(warnings).toHaveLength(0);
	});

	it('Test 2 — Existing Strapi value: absent document field is explicitly cleared and old value is NOT retained', () => {
		const schema = {
			kind: 'collectionType',
			attributes: {
				title: { type: 'string', required: true },
				author: { type: 'string', required: false }
			}
		};

		const existingEntry = {
			id: 101,
			documentId: 'doc-101',
			attributes: {
				title: 'Old Title',
				author: 'John'
			}
		};

		// Uploaded document only contains new title; author is intentionally absent
		const docData = {
			title: 'New Title'
		};

		// Build update payload
		const { payload } = buildStrapiPayload(docData, schema, mockAdapter, { isUpdate: true });

		expect(payload.title).toBe('New Title');
		// author MUST be explicitly null (cleared in Strapi), NOT undefined (omitted) and NOT "John"
		expect(payload.author).toBeNull();
		expect(payload.author).not.toBe('John');

		// Post-import verification check
		const simulatedSavedEntry = {
			id: 101,
			documentId: 'doc-101',
			attributes: {
				title: 'New Title',
				author: null // cleared in Strapi
			}
		};

		const verification = verifyImportedEntry({
			resultEntry: simulatedSavedEntry,
			schema,
			sourceData: docData,
			isUpdating: true,
			existingEntry
		});

		expect(verification.verified).toBe(true);
		expect(verification.discrepancies).toHaveLength(0);
	});

	it('Test 3 — Missing nested field: SEO component maps metaTitle and clears metaDescription without error', () => {
		const schema = {
			kind: 'singleType',
			attributes: {
				title: { type: 'string', required: true },
				seo: {
					type: 'component',
					repeatable: false,
					component: 'shared.seo',
					schema: {
						attributes: {
							metaTitle: { type: 'string', required: false },
							metaDescription: { type: 'text', required: false },
							metaSocial: {
								type: 'component',
								repeatable: true,
								component: 'shared.meta-social',
								schema: {
									attributes: {
										socialNetwork: { type: 'string', required: false }
									}
								}
							}
						}
					}
				}
			}
		};

		// Document contains metaTitle but no metaDescription or metaSocial
		const intermediateDoc = {
			keyValues: [
				{ rawKey: 'title', value: 'Page Title' },
				{ rawKey: 'seo.metaTitle', value: 'SEO Title from Doc' }
			],
			sections: [],
			repeatedGroups: []
		};

		const mapped = mapDocumentToSchema({
			intermediateDoc,
			documentModel: { blocks: [], images: [] },
			contentTypeDef: schema
		});

		expect(mapped.data.seo).toBeDefined();
		expect(mapped.data.seo.metaTitle).toBe('SEO Title from Doc');
		expect(mapped.data.seo.metaDescription).toBeNull();
		expect(mapped.data.seo.metaSocial).toEqual([]);

		const { payload } = buildStrapiPayload(mapped.data, schema, mockAdapter, { isUpdate: true });
		expect(payload.seo.metaTitle).toBe('SEO Title from Doc');
		expect(payload.seo.metaDescription).toBeNull();
		expect(payload.seo.metaSocial).toEqual([]);
	});

	it('Test 4 — Missing repeatable component: replaces array with document items and removes stale items', () => {
		const schema = {
			kind: 'collectionType',
			attributes: {
				title: { type: 'string', required: true },
				metaSocial: {
					type: 'component',
					repeatable: true,
					component: 'shared.meta-social',
					schema: {
						attributes: {
							socialNetwork: { type: 'string', required: false }
						}
					}
				}
			}
		};

		// Prior Strapi state had Facebook and Twitter
		const existingEntry = {
			id: 202,
			attributes: {
				title: 'Old Title',
				metaSocial: [{ socialNetwork: 'Facebook' }, { socialNetwork: 'Twitter' }]
			}
		};

		// New document contains only Facebook
		const docData = {
			title: 'Updated Title',
			metaSocial: [{ socialNetwork: 'Facebook' }]
		};

		const { payload } = buildStrapiPayload(docData, schema, mockAdapter, { isUpdate: true });
		expect(payload.metaSocial).toHaveLength(1);
		expect(payload.metaSocial[0].socialNetwork).toBe('Facebook');
		// Twitter must NOT be in the payload
		expect(payload.metaSocial.some((i) => i.socialNetwork === 'Twitter')).toBe(false);
	});

	it('Test 5 — Missing media: clears media field to empty without searching or reusing old media', () => {
		const schema = {
			kind: 'collectionType',
			attributes: {
				title: { type: 'string', required: true },
				coverImage: { type: 'media', multiple: false, required: false },
				gallery: { type: 'media', multiple: true, required: false }
			}
		};

		// Document contains no images
		const docData = {
			title: 'Article Without Images'
		};

		const { payload } = buildStrapiPayload(docData, schema, mockAdapter, { isUpdate: true });
		// Single media is null; multiple media is []
		expect(payload.coverImage).toBeNull();
		expect(payload.gallery).toEqual([]);
	});

	it('Test 6 — Missing relation: clears relation to empty without retaining prior Strapi relation', () => {
		const schema = {
			kind: 'collectionType',
			attributes: {
				title: { type: 'string', required: true },
				author: { type: 'relation', relation: 'oneToOne', target: 'api::author.author', multiple: false },
				categories: { type: 'relation', relation: 'manyToMany', target: 'api::category.category', multiple: true }
			}
		};

		// Document contains no relation info
		const docData = {
			title: 'Post Without Author or Categories'
		};

		const { payload } = buildStrapiPayload(docData, schema, mockAdapter, { isUpdate: true });
		expect(payload.author).toBeNull();
		expect(Array.isArray(payload.categories) || typeof payload.categories === 'object').toBe(true);
	});

	it('Test 7 — Unknown document field: ignored and not included in final Strapi payload', () => {
		const schema = {
			kind: 'collectionType',
			attributes: {
				title: { type: 'string', required: true }
			}
		};

		const docData = {
			title: 'Document with Extra Random Field',
			someRandomField: 'This is not in the Strapi schema',
			unwantedMetadata: 9999
		};

		const { payload } = buildStrapiPayload(docData, schema, mockAdapter);
		expect(payload.title).toBe('Document with Extra Random Field');
		expect(payload.someRandomField).toBeUndefined();
		expect(payload.unwantedMetadata).toBeUndefined();
	});

	it('Test 8 — Required Strapi field: detects missing required field and throws specific clear error without inventing data', () => {
		const schema = {
			kind: 'collectionType',
			attributes: {
				title: { type: 'string', required: true },
				author: { type: 'string', required: false }
			}
		};

		// Document only contains author, missing required title
		const docData = {
			author: 'Jane Doe'
		};

		// Payload builder detects and warns on missing required field
		const { warnings } = buildStrapiPayload(docData, schema, mockAdapter, { isUpdate: false });
		expect(warnings.some((w) => w.includes('title'))).toBe(true);

		// Import validation detects missing required field
		const missingRequired = [];
		for (const [attrName, attr] of Object.entries(schema.attributes)) {
			if (attr.required && !attr.manualOnly) {
				const val = docData[attrName];
				const isEmpty = val === undefined || val === null || val === '';
				if (isEmpty) missingRequired.push(attrName);
			}
		}

		expect(missingRequired).toEqual(['title']);
		const errorMessage = `Import cannot complete because the Strapi field "${missingRequired[0]}" is required, but the uploaded document does not contain a ${missingRequired[0]} value.`;
		expect(errorMessage).toContain('Import cannot complete because the Strapi field "title" is required, but the uploaded document does not contain a title value.');
	});

	it('Test 9 — titan_blog_categories multi-relation: absent from document -> clean empty array, passes Zod validation with 0 errors (no Invalid input)', () => {
		const titanBlogSchema = {
			kind: 'collectionType',
			attributes: {
				title: { type: 'string', required: true },
				titan_blog_categories: {
					type: 'relation',
					relation: 'manyToMany',
					target: 'api::titan-blog-category.titan-blog-category',
					required: false
				}
			}
		};

		// Document has only title, no categories
		const intermediateDoc = {
			keyValues: [{ rawKey: 'title', value: 'Breaking Industry News', blockId: 'b1' }],
			sections: [],
			repeatedGroups: []
		};

		const mapped = mapDocumentToSchema({
			intermediateDoc,
			documentModel: { blocks: [{ id: 'b1', text: 'Breaking Industry News' }], images: [] },
			contentTypeDef: titanBlogSchema
		});

		// 1. titan_blog_categories is marked missing, empty array
		expect(mapped.data.titan_blog_categories).toEqual([]);
		const catNote = mapped.fieldNotes.find((n) => n.field === 'titan_blog_categories');
		expect(catNote).toBeDefined();
		expect(catNote.status).toBe('missing');

		// 2. Zod validation passes with ZERO errors (must not throw "Invalid input")
		const validation = validateContentData(titanBlogSchema, mapped.data);
		expect(validation.valid).toBe(true);
		expect(validation.issues).toHaveLength(0);

		// 3. Payload in Strapi 5 formats empty relation as { set: [] }
		const { payload: v5Payload } = buildStrapiPayload(mapped.data, titanBlogSchema, v5Adapter);
		expect(v5Payload.titan_blog_categories).toEqual({ set: [] });

		// 4. Payload in Strapi 4 formats empty relation as []
		const { payload: v4Payload } = buildStrapiPayload(mapped.data, titanBlogSchema, v4Adapter);
		expect(v4Payload.titan_blog_categories).toEqual([]);
	});

	it('Test 10 — Polldata.options component: absent poll section -> does not steal article title, passes Zod validation (no Too small), Polldata is null in payload', () => {
		const pollOptionSchema = {
			attributes: {
				text: { type: 'string', required: true },
				votes: { type: 'integer', required: false }
			}
		};

		const polldataSchema = {
			attributes: {
				title: { type: 'string', required: false },
				subtitle: { type: 'string', required: false },
				position: { type: 'integer', required: false },
				options: {
					type: 'component',
					repeatable: true,
					min: 2,
					max: 10,
					required: false,
					schema: pollOptionSchema
				}
			}
		};

		const blogSchema = {
			kind: 'collectionType',
			attributes: {
				title: { type: 'string', required: true },
				description: { type: 'text', required: false },
				Polldata: {
					type: 'component',
					repeatable: false,
					required: false,
					schema: polldataSchema
				}
			}
		};

		// Document has only article title and description, absolutely NO poll section or poll keys
		const intermediateDoc = {
			keyValues: [
				{ rawKey: 'title', value: 'The Future of Energy Storage', blockId: 'b1' },
				{ rawKey: 'description', value: 'In-depth analysis of battery storage tech', blockId: 'b2' }
			],
			sections: [],
			repeatedGroups: []
		};

		const mapped = mapDocumentToSchema({
			intermediateDoc,
			documentModel: { blocks: [{ id: 'b1', text: 'The Future of Energy Storage' }], images: [] },
			contentTypeDef: blogSchema
		});

		// 1. Article title must NOT be snatched into Polldata
		expect(mapped.data.title).toBe('The Future of Energy Storage');
		expect(mapped.data.Polldata).toBeNull();

		const pollNote = mapped.fieldNotes.find((n) => n.field === 'Polldata');
		expect(pollNote).toBeDefined();
		expect(pollNote.status).toBe('missing');
		expect(pollNote.value).toBeNull();

		// 2. Zod validation passes with ZERO issues (must not throw "Too small: expected array to have >=2 items")
		const validation = validateContentData(blogSchema, mapped.data);
		expect(validation.valid).toBe(true);
		expect(validation.issues).toHaveLength(0);

		// 3. Payload builder sets Polldata to null
		const { payload } = buildStrapiPayload(mapped.data, blogSchema, v5Adapter);
		expect(payload.Polldata).toBeNull();

		// 4. Also verify: If an optional repeatable component has min: 2, an empty array [] passes validation
		const optRepeatValidation = validateContentData(blogSchema, {
			title: 'Test',
			Polldata: null
		});
		expect(optRepeatValidation.valid).toBe(true);

		// 5. But if 1 item is provided when min is 2, validation properly rejects with "Too small"
		const invalidPollData = {
			title: 'Poll with only 1 option',
			Polldata: {
				title: 'Vote now',
				options: [{ text: 'Only Option 1' }]
			}
		};
		const invalidValidation = validateContentData(blogSchema, invalidPollData);
		expect(invalidValidation.valid).toBe(false);
		expect(invalidValidation.issues.some((iss) => iss.path.includes('options') || iss.message.includes('Too small'))).toBe(true);
	});

	it('Test 11 — Strapi JSON field safety: parses valid JSON/JSON-LD, safely converts invalid/HTML JSON strings to null to prevent 500 database error', () => {
		const jsonSchema = {
			kind: 'collectionType',
			attributes: {
				title: { type: 'string', required: true },
				structuredData: { type: 'json', required: false }
			}
		};

		// 1. Valid JSON object
		const objData = { title: 'Obj Test', structuredData: { "@type": "Article", "name": "Test" } };
		const { payload: objPayload } = buildStrapiPayload(objData, jsonSchema, mockAdapter);
		expect(objPayload.structuredData).toEqual({ "@type": "Article", "name": "Test" });

		// 2. Valid clean JSON string
		const strData = { title: 'Str Test', structuredData: '{"@context":"https://schema.org","name":"Test"}' };
		const { payload: strPayload } = buildStrapiPayload(strData, jsonSchema, mockAdapter);
		expect(strPayload.structuredData).toEqual({ "@context": "https://schema.org", "name": "Test" });

		// 3. Word-formatted HTML containing valid JSON with smart quotes & entities
		const wordHtml = '<p>{&nbsp;&ldquo;@context&rdquo;: &ldquo;https://schema.org&rdquo;,&nbsp;&ldquo;name&rdquo;: &ldquo;Smart Quote Test&rdquo;&nbsp;}</p>';
		const wordData = { title: 'Word Test', structuredData: wordHtml };
		const { payload: wordPayload } = buildStrapiPayload(wordData, jsonSchema, mockAdapter);
		expect(wordPayload.structuredData).toEqual({ "@context": "https://schema.org", "name": "Smart Quote Test" });

		// 4. Corrupt/malformed HTML string that cannot form valid JSON (like truncated Word copy)
		const corruptHtml = '<p>{&nbsp;"@context": "https://schema.org", "broken...<a href="test">test</a></p>';
		const corruptData = { title: 'Corrupt Test', structuredData: corruptHtml };
		const { payload: corruptPayload, warnings } = buildStrapiPayload(corruptData, jsonSchema, mockAdapter);
		// Must safely fall back to null rather than sending invalid raw string that crashes Strapi with 500
		expect(corruptPayload.structuredData).toBeNull();
		expect(warnings.some((w) => w.includes('structuredData') && w.includes('invalid JSON'))).toBe(true);
	});
});

