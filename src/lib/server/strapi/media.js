import crypto from 'node:crypto';
import { getEnv } from '../env.js';

/**
 * Uploads an image buffer to Strapi /api/upload.
 *
 * @param {Buffer} buffer
 * @param {object} info
 * @param {string} info.filename
 * @param {string} info.mimeType
 * @param {string} [info.altText]
 * @returns {Promise<{ id: number, documentId?: string, url: string, name: string }>}
 */
export async function uploadMedia(buffer, info) {
	const { STRAPI_URL, STRAPI_API_TOKEN } = getEnv();

	const formData = new FormData();
	const blob = new Blob([new Uint8Array(buffer)], { type: info.mimeType });
	formData.append('files', blob, info.filename);

	const fileInfo = {
		name: info.filename,
		alternativeText: info.altText || info.filename,
		caption: info.altText || ''
	};
	formData.append('fileInfo', JSON.stringify(fileInfo));

	const headers = new Headers();
	if (STRAPI_API_TOKEN) {
		headers.set('Authorization', `Bearer ${STRAPI_API_TOKEN}`);
	}

	const res = await fetch(`${STRAPI_URL}/api/upload`, {
		method: 'POST',
		headers,
		body: formData
	});

	if (!res.ok) {
		const errText = await res.text();
		throw new Error(`Media upload failed (${res.status}): ${errText}`);
	}

	const result = await res.json();
	const uploaded = Array.isArray(result) ? result[0] : result;
	if (!uploaded || !uploaded.id) {
		throw new Error('Media upload succeeded but returned unexpected response shape');
	}

	return {
		id: uploaded.id,
		documentId: uploaded.documentId,
		url: uploaded.url,
		name: uploaded.name
	};
}

/**
 * Helper to manage media uploads per job with hashing to prevent duplicate uploads.
 */
export class JobMediaManager {
	constructor() {
		/** @type {Map<string, { id: number, documentId?: string, url: string }>} */
		this.uploadedByHash = new Map();
	}

	/**
	 * @param {Buffer} buffer
	 * @param {object} info
	 * @param {string} info.filename
	 * @param {string} info.mimeType
	 * @param {string} [info.altText]
	 */
	async uploadOrGet(buffer, info) {
		const hash = crypto.createHash('sha256').update(buffer).digest('hex');
		if (this.uploadedByHash.has(hash)) {
			return this.uploadedByHash.get(hash);
		}

		const uploaded = await uploadMedia(buffer, info);
		this.uploadedByHash.set(hash, uploaded);
		return uploaded;
	}
}
