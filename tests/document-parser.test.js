import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseDocx } from '../src/lib/server/document/parser.js';

describe('Document Parser', () => {
	it('parses standard document with headings and bullet lists', async () => {
		const buffer = fs.readFileSync(path.resolve('fixtures/docs/layout-1-standard.docx'));
		const model = await parseDocx(buffer);

		expect(model.blocks.length).toBeGreaterThan(0);
		expect(model.plainText).toContain('Cloud Migration & Modernization Services');

		// Check heading
		const h1 = model.blocks.find((b) => b.type === 'heading' && b.level === 1);
		expect(h1).toBeDefined();
		expect(h1?.text).toBe('Cloud Migration & Modernization Services');

		// Check markdown tags
		expect(model.markdown).toContain('[b1]');
		expect(model.markdown).toContain('# Cloud Migration & Modernization Services');

		// Check sections
		expect(model.sections.length).toBeGreaterThan(0);
	});

	it('promotes fake headings (bold or ALL CAPS) to headings', async () => {
		const buffer = fs.readFileSync(path.resolve('fixtures/docs/layout-2-fake-headings.docx'));
		const model = await parseDocx(buffer);

		// Find promoted heading
		const promoted = model.blocks.find((b) => b.inferredHeading === true);
		expect(promoted).toBeDefined();
		expect(promoted?.type).toBe('heading');
		expect(model.plainText).toContain('CYBERSECURITY OPERATIONS');

		// Check hints for promoted headings
		const hint = model.hints.find((h) => h.type === 'promoted_heading');
		expect(hint).toBeDefined();
	});

	it('parses tables and detects Q&A patterns', async () => {
		const buffer = fs.readFileSync(path.resolve('fixtures/docs/layout-3-tables-qa.docx'));
		const model = await parseDocx(buffer);

		// Check table block
		const tableBlock = model.blocks.find((b) => b.type === 'table');
		expect(tableBlock).toBeDefined();
		expect(tableBlock?.rows?.length).toBeGreaterThanOrEqual(3);
		expect(tableBlock?.rows?.[0]).toEqual(['Service', 'Description']);

		// Check hints for key-value table and Q&A
		const qaHint = model.hints.find((h) => h.type === 'qa_pattern');
		expect(qaHint).toBeDefined();
	});

	it('extracts embedded images with metadata and positions', async () => {
		const buffer = fs.readFileSync(path.resolve('fixtures/docs/layout-5-images-missing.docx'));
		const model = await parseDocx(buffer);

		expect(model.images.length).toBeGreaterThan(0);
		const img = model.images[0];
		expect(img.id).toBe('img-1');
		expect(img.mime).toContain('image/');
		expect(img.bytes).toBeGreaterThan(0);
		expect(img.buffer).toBeInstanceOf(Buffer);

		// Check image block in flow
		const imgBlock = model.blocks.find((b) => b.type === 'image');
		expect(imgBlock).toBeDefined();
		expect(imgBlock?.imageId).toBe('img-1');
	});
});
