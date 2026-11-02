import crypto from 'node:crypto';
import JSZip from 'jszip';
import { getEnv } from '../env.js';

const MAX_ZIP_ENTRIES = 1000;
const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024; // 50MB zip bomb guard

/**
 * Validates a DOCX file buffer against security threats:
 * - File extension and size
 * - ZIP signature (PK)
 * - Zip bomb prevention (entry count and total uncompressed size)
 * - Required Word parts (word/document.xml)
 * - Macro rejection (vbaProject.bin)
 * - Legacy / encrypted .doc rejection (OLE2 CFBF header)
 *
 * @param {Buffer} buffer
 * @param {string} originalFilename
 * @returns {Promise<{ sanitizedFilename: string, sha256: string, size: number, entryCount: number }>}
 */
export async function validateDocx(buffer, originalFilename = 'document.docx') {
	const { MAX_UPLOAD_MB } = getEnv();
	const maxBytes = MAX_UPLOAD_MB * 1024 * 1024;

	if (!buffer || !(buffer instanceof Buffer)) {
		throw new Error('Invalid file payload: not a buffer');
	}

	if (buffer.length === 0) {
		throw new Error('The uploaded file is empty.');
	}

	if (buffer.length > maxBytes) {
		throw new Error(
			`File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of ${MAX_UPLOAD_MB} MB.`
		);
	}

	// Check legacy OLE2 DOC file signature [0xD0, 0xCF, 0x11, 0xE0]
	if (
		buffer.length >= 4 &&
		buffer[0] === 0xd0 &&
		buffer[1] === 0xcf &&
		buffer[2] === 0x11 &&
		buffer[3] === 0xe0
	) {
		throw new Error(
			'Legacy binary Word (.doc) format or encrypted document is not supported. Please save as modern .docx.'
		);
	}

	// Check ZIP header "PK\x03\x04" or "PK\x05\x06" (empty zip)
	if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
		throw new Error('Invalid file format: file does not have a valid ZIP/DOCX signature.');
	}

	// Compute SHA-256
	const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

	// Sanitize original filename (remove path traversal, illegal chars)
	const baseName = originalFilename.split(/[/\\]/).pop() || 'document.docx';
	const sanitizedFilename = baseName
		.replace(/[^a-zA-Z0-9._-]/g, '_')
		.replace(/\.{2,}/g, '.')
		.toLowerCase();

	if (!sanitizedFilename.endsWith('.docx')) {
		throw new Error('Only .docx files are permitted.');
	}

	// Inspect ZIP entries using JSZip
	let zip;
	try {
		zip = await JSZip.loadAsync(buffer, { checkCRC32: true });
	} catch (err) {
		throw new Error(`Corrupted DOCX archive: ${err instanceof Error ? err.message : String(err)}`);
	}

	const fileEntries = Object.keys(zip.files);
	if (fileEntries.length > MAX_ZIP_ENTRIES) {
		throw new Error(
			`Security violation: ZIP contains too many entries (${fileEntries.length} > ${MAX_ZIP_ENTRIES}). Possible zip bomb.`
		);
	}

	let hasDocumentXml = false;
	let totalUncompressedSize = 0;

	for (const fileName of fileEntries) {
		const lowerName = fileName.toLowerCase();

		// Reject macro files
		if (
			lowerName.includes('vbaproject.bin') ||
			lowerName.endsWith('.vba') ||
			lowerName.includes('macrosheets')
		) {
			throw new Error(
				'Security violation: Macro-enabled Word documents (.docm / VBA) are strictly rejected.'
			);
		}

		if (lowerName === 'word/document.xml') {
			hasDocumentXml = true;
		}

		const entry = zip.files[fileName];
		// JSZip _data uncompressed size check if available
		// @ts-ignore
		const uncompressedSize = entry._data?.uncompressedSize || 0;
		totalUncompressedSize += uncompressedSize;

		if (totalUncompressedSize > MAX_UNCOMPRESSED_BYTES) {
			throw new Error(
				`Security violation: Total uncompressed content (${(totalUncompressedSize / (1024 * 1024)).toFixed(1)} MB) exceeds zip bomb protection limit (${MAX_UNCOMPRESSED_BYTES / (1024 * 1024)} MB).`
			);
		}
	}

	if (!hasDocumentXml) {
		throw new Error('Invalid DOCX file: missing required "word/document.xml" structure.');
	}

	return {
		sanitizedFilename,
		sha256,
		size: buffer.length,
		entryCount: fileEntries.length
	};
}
