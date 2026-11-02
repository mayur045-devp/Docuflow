import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getEnv } from '../env.js';
import { assertTransition } from './state-machine.js';

function getJobsDir() {
	const { DATA_DIR } = getEnv();
	const dir = path.resolve(DATA_DIR, 'jobs');
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
	return dir;
}

function getJobDir(jobId) {
	const sanitized = jobId.replace(/[^a-zA-Z0-9_-]/g, '');
	return path.join(getJobsDir(), sanitized);
}

/**
 * Creates a new job and saves source.docx on disk.
 *
 * @param {object} params
 * @param {string} params.originalFilename
 * @param {string} params.sha256
 * @param {Buffer} params.buffer
 * @param {string} params.contentTypeUid
 * @returns {any}
 */
export function createJob({ originalFilename, sha256, buffer, contentTypeUid }) {
	const jobId = crypto.randomUUID();
	const jobDir = getJobDir(jobId);
	fs.mkdirSync(jobDir, { recursive: true });

	// Save source DOCX
	fs.writeFileSync(path.join(jobDir, 'source.docx'), buffer);

	const now = new Date().toISOString();
	const jobMeta = {
		id: jobId,
		state: 'uploaded',
		originalFilename,
		sha256,
		fileSize: buffer.length,
		contentTypeUid, // LOCKED at creation
		approved: false,
		createdAt: now,
		updatedAt: now
	};

	fs.writeFileSync(path.join(jobDir, 'job.json'), JSON.stringify(jobMeta, null, 2));
	return jobMeta;
}

/**
 * Reads job metadata.
 * @param {string} jobId
 * @returns {any|null}
 */
export function getJob(jobId) {
	const jobDir = getJobDir(jobId);
	const metaPath = path.join(jobDir, 'job.json');
	if (!fs.existsSync(metaPath)) return null;

	try {
		return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
	} catch {
		return null;
	}
}

/**
 * Updates job state and metadata.
 * @param {string} jobId
 * @param {string} nextState
 * @param {object} [updates={}]
 */
export function updateJobState(jobId, nextState, updates = {}) {
	const job = getJob(jobId);
	if (!job) throw new Error(`Job not found: ${jobId}`);

	assertTransition(job.state, /** @type {import('./state-machine.js').JobState} */ (nextState));

	const updated = {
		...job,
		...updates,
		state: nextState,
		updatedAt: new Date().toISOString()
	};

	const jobDir = getJobDir(jobId);
	fs.writeFileSync(path.join(jobDir, 'job.json'), JSON.stringify(updated, null, 2));
	return updated;
}

/**
 * Saves parsed document and writes images to disk.
 * @param {string} jobId
 * @param {import('../document/model.js').DocumentModel} documentModel
 */
export function saveParsedDocument(jobId, documentModel) {
	const jobDir = getJobDir(jobId);
	const imagesDir = path.join(jobDir, 'images');
	fs.mkdirSync(imagesDir, { recursive: true });

	// Save images to disk
	for (const img of documentModel.images || []) {
		if (img.buffer) {
			const ext = img.mime?.includes('jpeg') ? 'jpg' : 'png';
			fs.writeFileSync(path.join(imagesDir, `${img.id}.${ext}`), img.buffer);
		}
	}

	// Save document model (strip buffers from json)
	const cleanImages = (documentModel.images || []).map(({ buffer: _buf, ...meta }) => meta);
	const cleanModel = {
		...documentModel,
		images: cleanImages
	};

	fs.writeFileSync(path.join(jobDir, 'document.json'), JSON.stringify(cleanModel, null, 2));
}

/**
 * Gets the parsed document for a job.
 * @param {string} jobId
 * @returns {import('../document/model.js').DocumentModel|null}
 */
export function getParsedDocument(jobId) {
	const filePath = path.join(getJobDir(jobId), 'document.json');
	if (!fs.existsSync(filePath)) return null;
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Saves AI extraction result.
 * @param {string} jobId
 * @param {any} extraction
 */
export function saveExtraction(jobId, extraction) {
	const jobDir = getJobDir(jobId);
	fs.writeFileSync(path.join(jobDir, 'extraction.json'), JSON.stringify(extraction, null, 2));
}

/**
 * Gets AI extraction result.
 * @param {string} jobId
 * @returns {any|null}
 */
export function getExtraction(jobId) {
	const filePath = path.join(getJobDir(jobId), 'extraction.json');
	if (!fs.existsSync(filePath)) return null;
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Saves user review edits and validation issues.
 * @param {string} jobId
 * @param {any} reviewData
 * @param {any[]} issues
 * @param {boolean} approved
 */
export function saveReview(jobId, reviewData, issues = [], approved = false) {
	const jobDir = getJobDir(jobId);
	const payload = {
		data: reviewData,
		issues,
		approved,
		reviewedAt: new Date().toISOString()
	};
	fs.writeFileSync(path.join(jobDir, 'review.json'), JSON.stringify(payload, null, 2));
}

/**
 * Gets user review data.
 * @param {string} jobId
 * @returns {any|null}
 */
export function getReview(jobId) {
	const filePath = path.join(getJobDir(jobId), 'review.json');
	if (!fs.existsSync(filePath)) return null;
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Saves final Strapi import result.
 * @param {string} jobId
 * @param {any} result
 */
export function saveResult(jobId, result) {
	const jobDir = getJobDir(jobId);
	fs.writeFileSync(path.join(jobDir, 'result.json'), JSON.stringify(result, null, 2));
}

/**
 * Gets final import result.
 * @param {string} jobId
 * @returns {any|null}
 */
export function getResult(jobId) {
	const filePath = path.join(getJobDir(jobId), 'result.json');
	if (!fs.existsSync(filePath)) return null;
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Serves an extracted image file.
 * @param {string} jobId
 * @param {string} imageId e.g. "img-1"
 * @returns {{ buffer: Buffer, mime: string }|null}
 */
export function getJobImage(jobId, imageId) {
	const imagesDir = path.join(getJobDir(jobId), 'images');
	const cleanImageId = imageId.replace(/[^a-zA-Z0-9_-]/g, '');

	const possibleFiles = [
		path.join(imagesDir, `${cleanImageId}.png`),
		path.join(imagesDir, `${cleanImageId}.jpg`),
		path.join(imagesDir, `${cleanImageId}.jpeg`)
	];

	for (const f of possibleFiles) {
		if (fs.existsSync(f)) {
			const mime = f.endsWith('.png') ? 'image/png' : 'image/jpeg';
			return { buffer: fs.readFileSync(f), mime };
		}
	}
	return null;
}

/**
 * Lists all jobs sorted by creation date descending.
 * Flags duplicates if the same file sha256 was processed before.
 * @returns {any[]}
 */
export function listJobs() {
	const jobsDir = getJobsDir();
	if (!fs.existsSync(jobsDir)) return [];

	const dirs = fs.readdirSync(jobsDir, { withFileTypes: true });
	const jobs = [];

	for (const entry of dirs) {
		if (entry.isDirectory()) {
			const meta = getJob(entry.name);
			if (meta) {
				jobs.push(meta);
			}
		}
	}

	jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

	// Detect duplicates by sha256
	const seenHashes = new Set();
	for (const j of jobs) {
		if (seenHashes.has(j.sha256)) {
			j.duplicateDoc = true;
		}
		seenHashes.add(j.sha256);
	}

	return jobs;
}

/**
 * Auto-deletes jobs older than JOB_TTL_DAYS.
 */
export function cleanupExpiredJobs() {
	const { JOB_TTL_DAYS } = getEnv();
	const jobsDir = getJobsDir();
	if (!fs.existsSync(jobsDir)) return;

	const now = Date.now();
	const maxAgeMs = JOB_TTL_DAYS * 24 * 60 * 60 * 1000;

	const entries = fs.readdirSync(jobsDir, { withFileTypes: true });
	for (const entry of entries) {
		if (entry.isDirectory()) {
			const meta = getJob(entry.name);
			if (meta && meta.createdAt) {
				const age = now - new Date(meta.createdAt).getTime();
				if (age > maxAgeMs) {
					fs.rmSync(path.join(jobsDir, entry.name), { recursive: true, force: true });
				}
			}
		}
	}
}
