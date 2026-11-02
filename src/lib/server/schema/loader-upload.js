import fs from 'node:fs';
import path from 'node:path';
import { getEnv } from '../env.js';
import { normalizeContentType } from './normalize.js';

/** @type {Record<string, any>} */
const uploadedComponents = {};
/** @type {Record<string, any>} */
const uploadedContentTypes = {};

let initialized = false;

function getUploadDir() {
	const { DATA_DIR } = getEnv();
	const dir = path.resolve(DATA_DIR, 'uploaded-schemas');
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
	return dir;
}

function initFromDisk() {
	if (initialized) return;
	initialized = true;

	try {
		const dir = getUploadDir();
		const compFile = path.join(dir, 'components.json');
		const ctFile = path.join(dir, 'content-types.json');

		if (fs.existsSync(compFile)) {
			Object.assign(uploadedComponents, JSON.parse(fs.readFileSync(compFile, 'utf8')));
		}
		if (fs.existsSync(ctFile)) {
			Object.assign(uploadedContentTypes, JSON.parse(fs.readFileSync(ctFile, 'utf8')));
		}
	} catch {
		// Ignore read error on fresh disk
	}
}

function saveToDisk() {
	try {
		const dir = getUploadDir();
		fs.writeFileSync(
			path.join(dir, 'components.json'),
			JSON.stringify(uploadedComponents, null, 2)
		);
		fs.writeFileSync(
			path.join(dir, 'content-types.json'),
			JSON.stringify(uploadedContentTypes, null, 2)
		);
	} catch (err) {
		console.warn('Could not persist uploaded schemas to disk:', err);
	}
}

/**
 * Registers an uploaded or pasted content type schema with optional component schemas.
 *
 * @param {any} contentTypeSchema
 * @param {Record<string, any>} [componentsMap={}]
 * @returns {any} Normalized ContentTypeDef
 */
export function registerUploadedSchema(contentTypeSchema, componentsMap = {}) {
	initFromDisk();

	Object.assign(uploadedComponents, componentsMap);

	const singular =
		contentTypeSchema.info?.singularName ||
		contentTypeSchema.collectionName ||
		'custom-content-type';
	const uid = contentTypeSchema.uid || `api::${singular}.${singular}`;
	contentTypeSchema.uid = uid;

	const normalized = normalizeContentType(contentTypeSchema, uploadedComponents);
	uploadedContentTypes[uid] = normalized;

	saveToDisk();
	return normalized;
}

/**
 * Returns all user-uploaded content types.
 * @returns {{ contentTypes: Record<string, any>, components: Record<string, any> }}
 */
export function getUploadedSchemas() {
	initFromDisk();
	return {
		contentTypes: { ...uploadedContentTypes },
		components: { ...uploadedComponents }
	};
}
