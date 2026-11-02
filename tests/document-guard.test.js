import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { validateDocx } from '../src/lib/server/security/docx-guard.js';

describe('DOCX Guard', () => {
	const validDocxBuffer = fs.readFileSync(path.resolve('fixtures/docs/layout-1-standard.docx'));

	it('accepts a valid DOCX file', async () => {
		const result = await validateDocx(validDocxBuffer, 'My Project.docx');
		expect(result.sanitizedFilename).toBe('my_project.docx');
		expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
		expect(result.size).toBe(validDocxBuffer.length);
		expect(result.entryCount).toBeGreaterThan(0);
	});

	it('rejects empty file buffers', async () => {
		await expect(validateDocx(Buffer.alloc(0), 'empty.docx')).rejects.toThrow(
			/uploaded file is empty/i
		);
	});

	it('rejects legacy OLE2 binary .doc files', async () => {
		const ole2Header = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb2, 0x1a, 0xe1]);
		await expect(validateDocx(ole2Header, 'legacy.docx')).rejects.toThrow(/legacy binary word/i);
	});

	it('rejects non-zip files with invalid signatures', async () => {
		const invalidBuffer = Buffer.from('This is a plain text file pretending to be docx');
		await expect(validateDocx(invalidBuffer, 'fake.docx')).rejects.toThrow(
			/does not have a valid zip/i
		);
	});

	it('rejects macro-enabled files containing vbaProject.bin', async () => {
		const zip = new JSZip();
		zip.file('word/document.xml', '<w:document></w:document>');
		zip.file('word/vbaProject.bin', Buffer.from('fake-vba-macro-bytes'));
		const macroBuffer = await zip.generateAsync({ type: 'nodebuffer' });

		await expect(validateDocx(macroBuffer, 'document.docx')).rejects.toThrow(
			/macro-enabled word documents/i
		);
	});

	it('rejects zip archives missing word/document.xml', async () => {
		const zip = new JSZip();
		zip.file('something_else.xml', '<root></root>');
		const invalidZipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

		await expect(validateDocx(invalidZipBuffer, 'test.docx')).rejects.toThrow(
			/missing required "word\/document\.xml"/i
		);
	});

	it('rejects files with non-docx extensions in sanitized name', async () => {
		await expect(validateDocx(validDocxBuffer, 'file.exe')).rejects.toThrow(
			/only \.docx files are permitted/i
		);
	});
});
