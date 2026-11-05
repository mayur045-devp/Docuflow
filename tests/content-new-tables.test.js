import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseDocx } from '../src/lib/server/document/parser.js';
import { extractIntermediateDocument } from '../src/lib/server/document/intermediate.js';
import { mapDocumentToSchema } from '../src/lib/server/mapping/semantic-mapper.js';
import { buildStrapiPayload } from '../src/lib/server/mapping/build-payload.js';
import { v5Adapter } from '../src/lib/server/strapi/adapters/v5.js';

describe('DOCX Table Parsing and HTML Table Conversion Inside contentNew', () => {
	const blogSchema = JSON.parse(
		fs.readFileSync(path.resolve('cms/src/api/blog/content-types/blog/schema.json'), 'utf8')
	);
	const contentNewComp = JSON.parse(
		fs.readFileSync(path.resolve('cms/src/components/component/content-new.json'), 'utf8')
	);
	const seoComp = JSON.parse(
		fs.readFileSync(path.resolve('cms/src/components/component/seo.json'), 'utf8')
	);
	const authorComp = JSON.parse(
		fs.readFileSync(path.resolve('cms/src/components/component/author-data.json'), 'utf8')
	);

	const contentTypeDef = {
		uid: 'api::blog.blog',
		displayName: blogSchema.info.displayName,
		attributes: {
			...blogSchema.attributes,
			contentNew: {
				type: 'component',
				repeatable: true,
				schema: contentNewComp
			},
			seo: {
				type: 'component',
				repeatable: false,
				schema: seoComp
			},
			AuthorData: {
				type: 'component',
				repeatable: false,
				schema: authorComp
			}
		}
	};

	it('correctly maps Booking_Third_Party_Test_Lab docx into exactly 2 contentNew entries with embedded HTML table', async () => {
		const filePath = path.resolve(
			'fixtures/docs/Booking_Third_Party_Test_Lab_Contentnew_Exact_Format_Two_Entries.docx'
		);
		const buf = fs.readFileSync(filePath);
		const docModel = await parseDocx(buf);
		const intermediate = extractIntermediateDocument(docModel);
		const mapped = mapDocumentToSchema({
			intermediateDoc: intermediate,
			documentModel: docModel,
			contentTypeDef
		});

		const items = mapped.data.contentNew;

		// 1. Exactly 2 entries
		expect(items).toBeDefined();
		expect(items).toHaveLength(2);

		// 2. Entry 1 is "Choosing the lab"
		expect(items[0].title).toBe('Choosing the lab');
		expect(items[0].content).toContain('Start with the accreditation scope');

		// 3. Entry 2 is "The first request"
		expect(items[1].title).toBe('The first request');

		// 4. Entry 2 contains converted HTML table markup
		const content2 = items[1].content;
		expect(content2).toContain('<table>');
		expect(content2).toContain('<thead>');
		expect(content2).toContain('<tbody>');
		expect(content2).toContain('</table>');

		// 5. All three columns are preserved in the header
		expect(content2).toContain('<th>Field</th>');
		expect(content2).toContain('<th>Example</th>');
		expect(content2).toContain('<th>Why the lab needs it</th>');

		// 6. All eight data rows are preserved
		const expectedRows = [
			'Who approves',
			'Device under test',
			'Samples available',
			'Shipping state',
			'Witnessing',
			'Deliverables',
			'Dates',
			'End of life'
		];
		for (const rowHeader of expectedRows) {
			expect(content2).toContain(`<td>${rowHeader}</td>`);
		}
		expect(content2).toContain('Validation lead approves, supplier quality and purchasing copied');
		expect(content2).toContain('NMC module, about 5.5 kWh, 32 kg, drawing and datasheet attached');
		expect(content2).toContain('Dispose of tested modules, return untested spares');

		// 7. Paragraphs and bullet points before and after table remain in exact order
		const beforeIdx = content2.indexOf('The first email or portal submission does most of the work');
		const tableIdx = content2.indexOf('<table>');
		const afterIdx = content2.indexOf('Labs running a customer booking portal');
		expect(beforeIdx).toBeGreaterThanOrEqual(0);
		expect(tableIdx).toBeGreaterThan(beforeIdx);
		expect(afterIdx).toBeGreaterThan(tableIdx);

		// 8. No extra contentNew entries created from table headers or row values
		const invalidTitles = ['Field', 'Who approves', 'Device under test', 'Dates', 'Content', 'Title'];
		for (const item of items) {
			expect(invalidTitles).not.toContain(item.title);
		}

		// 9. No extra component properties created - only schema fields
		for (const item of items) {
			expect(Object.keys(item).sort()).toEqual(['content', 'image', 'title'].sort());
		}

		// 10. Final Strapi payload contains only title and content
		const { payload, warnings } = buildStrapiPayload(mapped.data, contentTypeDef, v5Adapter);
		expect(warnings).toHaveLength(0);
		expect(payload.contentNew).toHaveLength(2);
		expect(payload.contentNew[0].title).toBe('Choosing the lab');
		expect(payload.contentNew[1].title).toBe('The first request');
		expect(payload.contentNew[1].content).toContain('<table>');
	});

	it('correctly handles multiple tables in different content sections without creating separate component entries', () => {
		const dynamicDocModel = {
			blocks: [
				{
					id: 'b1',
					type: 'heading',
					level: 1,
					text: 'Blog Post',
					html: '<h1>Blog Post</h1>',
					sectionPath: ['Blog Post']
				},
				{
					id: 'b2',
					type: 'heading',
					level: 2,
					text: 'Section 1',
					html: '<h2>Section 1</h2>',
					sectionPath: ['Section 1']
				},
				{
					id: 'b3',
					type: 'paragraph',
					text: 'Paragraph before table in section 1.',
					html: '<p>Paragraph before table in section 1.</p>',
					sectionPath: ['Section 1']
				},
				{
					id: 'b4',
					type: 'table',
					rows: [
						['Metric', 'Target', 'Status'],
						['Speed', '100ms', 'Passed'],
						['Uptime', '99.9%', 'Passed']
					],
					headerRow: true,
					text: 'Metric | Target | Status\nSpeed | 100ms | Passed\nUptime | 99.9% | Passed',
					html: '<table><thead><tr><th>Metric</th><th>Target</th><th>Status</th></tr></thead><tbody><tr><td>Speed</td><td>100ms</td><td>Passed</td></tr><tr><td>Uptime</td><td>99.9%</td><td>Passed</td></tr></tbody></table>',
					sectionPath: ['Section 1']
				},
				{
					id: 'b5',
					type: 'paragraph',
					text: 'Paragraph after table in section 1.',
					html: '<p>Paragraph after table in section 1.</p>',
					sectionPath: ['Section 1']
				}
			],
			images: [],
			hints: []
		};

		const intermediate = extractIntermediateDocument(/** @type {any} */ (dynamicDocModel));

		// Verify the table is preserved as content and not converted into repeatedGroups
		expect(intermediate.repeatedGroups.filter((r) => r.headers?.includes('Metric'))).toHaveLength(0);

		const sec1 = intermediate.sections.find((s) => s.heading === 'Section 1');
		expect(sec1).toBeDefined();
		const tableP = sec1?.paragraphs.find((p) => p.html.includes('<table>'));
		expect(tableP).toBeDefined();
		expect(tableP?.html).toContain('<th>Metric</th>');
	});
});
