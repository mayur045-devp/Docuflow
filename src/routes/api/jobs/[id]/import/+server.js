import crypto from 'node:crypto';
import { json } from '@sveltejs/kit';
import { actionLimiter } from '$lib/server/security/rate-limit.js';
import {
	getJob,
	getReview,
	getExtraction,
	getJobImage,
	saveResult,
	updateJobState,
	getResult
} from '$lib/server/jobs/store.js';
import { getContentTypeSchema } from '$lib/server/schema/resolve.js';
import { validateContentData } from '$lib/server/schema/to-zod.js';
import { getStrapiAdapter } from '$lib/server/strapi/adapter.js';
import { buildStrapiPayload } from '$lib/server/mapping/build-payload.js';
import { ensureUniqueSlug } from '$lib/server/mapping/slug.js';
import { JobMediaManager } from '$lib/server/strapi/media.js';

export async function POST({ params, request, getClientAddress }) {
	const ip = getClientAddress ? getClientAddress() : '127.0.0.1';
	const rateCheck = actionLimiter.check(ip);
	if (!rateCheck.allowed) {
		return json(
			{
				error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please wait a moment.' }
			},
			{ status: 429 }
		);
	}

	const { id } = params;
	const job = getJob(id);

	if (!job) {
		return json({ error: { code: 'NOT_FOUND', message: `Job ${id} not found` } }, { status: 404 });
	}

	// Idempotency guard: if already imported, return stored result
	if (job.state === 'imported') {
		const existingResult = getResult(id);
		return json({
			idempotent: true,
			...existingResult
		});
	}

	let body;
	try {
		body = await request.json();
	} catch {
		body = {};
	}

	const approved = Boolean(body.approved);
	const dryRun = Boolean(body.dryRun);
	const onDuplicate = body.onDuplicate || 'cancel'; // 'cancel' | 'create_new' | 'update'
	const publish = Boolean(body.publish); // Drafts by default! (Principle 5)

	// Principle 3: Human approval is mandatory and enforced server-side
	if (!approved && !dryRun) {
		return json(
			{
				error: {
					code: 'APPROVAL_REQUIRED',
					message: 'Human approval is mandatory before creating entries in Strapi.'
				}
			},
			{ status: 400 }
		);
	}

	// Retrieve data from review or extraction
	const review = getReview(id);
	const extraction = getExtraction(id);
	const sourceData = review?.data || extraction?.data;

	if (!sourceData) {
		return json(
			{ error: { code: 'NO_DATA', message: 'No reviewed data available for import.' } },
			{ status: 400 }
		);
	}

	const schema = await getContentTypeSchema(job.contentTypeUid, { forceRefresh: true });
	if (!schema) {
		return json(
			{
				error: {
					code: 'SCHEMA_NOT_FOUND',
					message: `Target collection "${job.contentTypeUid}" was not found in Strapi. It may have been renamed or deleted.`
				}
			},
			{ status: 404 }
		);
	}

	// Schema synchronization check: verify schema has not changed since extraction
	const currentFingerprint = crypto
		.createHash('sha256')
		.update(JSON.stringify(schema.attributes || {}))
		.digest('hex');

	if (
		extraction?.schemaFingerprint &&
		extraction.schemaFingerprint !== currentFingerprint &&
		!body.force
	) {
		return json(
			{
				schemaChanged: true,
				error: {
					code: 'SCHEMA_MODIFIED',
					message: `The schema for "${schema.displayName || job.contentTypeUid}" was modified in Strapi since document extraction. Please revalidate your reviewed fields.`
				}
			},
			{ status: 409 }
		);
	}

	// Scenario A: Strip any extra properties from sourceData that are NOT in the target Strapi schema
	const validAttributes = new Set(Object.keys(schema.attributes || {}));
	for (const key of Object.keys(sourceData)) {
		if (!validAttributes.has(key)) {
			delete sourceData[key];
		}
	}

	// Scenario B: Check required fields. Never silently fabricate or import without required values.
	if (!dryRun) {
		const missingRequired = [];
		for (const [attrName, attr] of Object.entries(schema.attributes || {})) {
			if (attr.required && !attr.manualOnly) {
				const val = sourceData[attrName];
				const isEmpty =
					val === undefined ||
					val === null ||
					(typeof val === 'string' && val.trim() === '') ||
					(Array.isArray(val) && val.length === 0);
				if (isEmpty) {
					missingRequired.push(attrName);
				}
			}
		}

		if (missingRequired.length > 0) {
			return json(
				{
					error: {
						code: 'MISSING_REQUIRED_FIELDS',
						message: `Required field(s) missing: ${missingRequired.join(', ')}. Please provide a value before approving and importing.`,
						details: missingRequired.map((f) => ({
							path: f,
							message: `Field "${f}" is required by Strapi.`
						}))
					}
				},
				{ status: 400 }
			);
		}
	}

	// Server-side validation against schema
	const validation = validateContentData(schema, sourceData);
	if (!validation.valid && !dryRun) {
		return json(
			{
				error: {
					code: 'VALIDATION_FAILED',
					message: 'Data failed schema validation.',
					details: validation.issues
				}
			},
			{ status: 400 }
		);
	}

	let adapter;
	try {
		adapter = await getStrapiAdapter();
	} catch (adapterErr) {
		const msg = adapterErr instanceof Error ? adapterErr.message : String(adapterErr);
		return json(
			{
				error: {
					code: 'STRAPI_CONNECTION_ERROR',
					message: msg
				}
			},
			{ status: 502 }
		);
	}

	const isSingleType = schema.kind === 'singleType';
	const endpoint = isSingleType ? schema.singularName : (schema.pluralName || `${schema.singularName}s`);

	console.log(`[Import] Preparing import for job ${id}: collection=${job.contentTypeUid}, kind=${schema.kind || 'collectionType'}, endpoint=${endpoint}`);

	// Duplicate detection: check by slug and title (collection types only)
	const slugToCheck = sourceData.slug;
	const titleToCheck = sourceData.title;
	let existingEntry = null;

	if (!isSingleType && (slugToCheck || titleToCheck)) {
		try {
			if (slugToCheck) {
				existingEntry = await adapter.findByField(endpoint, 'slug', slugToCheck);
			}
			if (!existingEntry && titleToCheck) {
				existingEntry = await adapter.findByField(endpoint, 'title', titleToCheck);
			}
		} catch (dupErr) {
			if (dryRun) {
				console.warn('Dry run: Strapi duplicate check skipped due to connection error:', dupErr);
			} else {
				console.error('Strapi duplicate check failed:', dupErr);
				const is404 = dupErr && /** @type {any} */ (dupErr).status === 404;
				const is401 = dupErr && /** @type {any} */ (dupErr).status === 401;
				const msg = is404
					? `Strapi collection endpoint "/api/${endpoint}" was not found (404 Not Found). Please verify that the collection type exists and is enabled in your Strapi CMS.`
					: is401
						? `Strapi authentication failed (401 Unauthorized: Missing or invalid credentials). Please verify that STRAPI_API_TOKEN in your .env file is valid and has Full Access permissions in Strapi Settings > API Tokens (or run "npm run strapi:token" if using local CMS).`
						: dupErr instanceof Error
							? dupErr.message
							: String(dupErr);
				return json(
					{
						error: {
							code: is404
								? 'STRAPI_ENDPOINT_NOT_FOUND'
								: is401
									? 'STRAPI_UNAUTHORIZED'
									: 'STRAPI_CONNECTION_ERROR',
							message: msg
						}
					},
					{ status: is404 ? 404 : is401 ? 401 : 502 }
				);
			}
		}
	}

	if (existingEntry) {
		if (onDuplicate === 'cancel' && !dryRun) {
			return json({
				duplicate: true,
				existing: {
					id: existingEntry.id,
					documentId: existingEntry.documentId,
					title: existingEntry.attributes?.title || titleToCheck,
					slug: existingEntry.attributes?.slug || slugToCheck
				},
				message:
					'This entry already exists in Strapi. Choose to update the draft, create a new entry with an auto-suffixed slug, or cancel.'
			});
		}
	}

	// Handle slug collision if create_new requested
	if (existingEntry && onDuplicate === 'create_new') {
		try {
			sourceData.slug = await ensureUniqueSlug({
				endpoint,
				baseSlug: slugToCheck || 'entry',
				adapter
			});
		} catch (slugErr) {
			console.error('Slug uniqueness check failed:', slugErr);
		}
	}

	// Media resolution & upload (recursive across top-level and components)
	const mediaManager = new JobMediaManager();
	const resolvedMedia = [];

	/**
	 * Recursively resolves and uploads embedded document images (img-X)
	 * @param {any} dataObj
	 * @param {Record<string, any>} schemaAttributes
	 * @param {string} [currentPath='']
	 */
	async function resolveAndUploadMedia(dataObj, schemaAttributes, currentPath = '') {
		if (!dataObj || typeof dataObj !== 'object') return;
		for (const [key, attr] of Object.entries(schemaAttributes || {})) {
			const val = dataObj[key];
			const fieldPath = currentPath ? `${currentPath}.${key}` : key;
			if (!val) continue;

			if (attr.type === 'media') {
				if (Array.isArray(val)) {
					const uploadedIds = [];
					for (let i = 0; i < val.length; i++) {
						const item = val[i];
						const imgId = typeof item === 'object' && item?.$docImage ? item.$docImage : String(item);
						if (imgId.startsWith('img-')) {
							const imgFile = getJobImage(id, imgId);
							if (imgFile) {
								if (!dryRun) {
									try {
										const uploaded = await mediaManager.uploadOrGet(imgFile.buffer, {
											filename: `${sourceData.slug || 'media'}-${imgId}.${imgFile.mime.includes('jpeg') ? 'jpg' : 'png'}`,
											mimeType: imgFile.mime,
											altText: sourceData.title || imgId
										});
										uploadedIds.push(uploaded.id);
										resolvedMedia.push({ field: `${fieldPath}.${i}`, imageId: imgId, uploadedId: uploaded.id });
									} catch (uploadErr) {
										console.warn(`Image upload failed for ${fieldPath}.${i}:`, uploadErr);
									}
								} else {
									resolvedMedia.push({ field: `${fieldPath}.${i}`, imageId: imgId, status: 'ready_for_upload' });
								}
							}
						} else if (item && typeof item === 'number') {
							uploadedIds.push(item);
						}
					}
					if (!dryRun) {
						dataObj[key] = uploadedIds;
					}
				} else {
					const imageId = typeof val === 'object' && val?.$docImage ? val.$docImage : String(val);
					if (imageId.startsWith('img-')) {
						const imgFile = getJobImage(id, imageId);
						if (imgFile) {
							if (!dryRun) {
								try {
									const uploaded = await mediaManager.uploadOrGet(imgFile.buffer, {
										filename: `${sourceData.slug || 'media'}-${imageId}.${imgFile.mime.includes('jpeg') ? 'jpg' : 'png'}`,
										mimeType: imgFile.mime,
										altText: sourceData.title || imageId
									});
									dataObj[key] = attr.multiple ? [uploaded.id] : uploaded.id;
									resolvedMedia.push({ field: fieldPath, imageId, uploadedId: uploaded.id });
								} catch (uploadErr) {
									console.warn(`Image upload failed for ${fieldPath}, proceeding with null media:`, uploadErr);
									dataObj[key] = attr.multiple ? [] : null;
								}
							} else {
								resolvedMedia.push({ field: fieldPath, imageId, status: 'ready_for_upload' });
							}
						}
					}
				}
			} else if (attr.type === 'component') {
				if (attr.repeatable && Array.isArray(val)) {
					for (let idx = 0; idx < val.length; idx++) {
						await resolveAndUploadMedia(val[idx], attr.schema?.attributes, `${fieldPath}.${idx}`);
					}
				} else if (typeof val === 'object') {
					await resolveAndUploadMedia(val, attr.schema?.attributes, fieldPath);
				}
			}
		}
	}

	await resolveAndUploadMedia(sourceData, schema.attributes);

	// Build final payload formatted by version adapter
	const isUpdating = Boolean(existingEntry && onDuplicate === 'update');
	const { payload, warnings } = buildStrapiPayload(sourceData, schema, adapter, {
		isUpdate: isUpdating
	});

	if (dryRun) {
		return json({
			dryRun: true,
			payload,
			resolvedMedia,
			duplicateDetected: Boolean(existingEntry),
			existingEntry: existingEntry
				? { id: existingEntry.id, documentId: existingEntry.documentId }
				: null,
			warnings
		});
	}

	// Real import execution
	updateJobState(id, 'importing');

	try {
		const method = isSingleType ? 'PUT' : (isUpdating && existingEntry ? 'PUT' : 'POST');
		console.log(`[Import] Submitting payload to Strapi:`, {
			displayName: schema.displayName,
			category: isSingleType ? 'Single Type' : 'Collection Type',
			apiId: isSingleType ? schema.singularName : schema.pluralName,
			strapiVersion: adapter.version,
			endpoint: `/api/${endpoint}`,
			method,
			draft: !publish
		});

		let resultEntry;
		if (isUpdating && existingEntry) {
			const targetId = existingEntry.documentId || existingEntry.id;
			resultEntry = await adapter.update(endpoint, targetId, payload, { draft: !publish, isSingleType });
		} else {
			resultEntry = await adapter.create(endpoint, payload, { draft: !publish, isSingleType });
		}

		if (publish) {
			const publishTarget = resultEntry.documentId || resultEntry.id;
			await adapter.publish(endpoint, publishTarget, { isSingleType });
		}

		const adminUrl = adapter.adminLink(resultEntry, schema.singularName, schema.kind, schema.uid);
		console.log(`[Import] Import successful for job ${id}: entryId=${resultEntry.id}, documentId=${resultEntry.documentId || 'n/a'}, adminUrl=${adminUrl}`);

		const finalResult = {
			success: true,
			entryId: resultEntry.id,
			documentId: resultEntry.documentId,
			adminUrl,
			draft: !publish,
			warnings,
			timestamp: new Date().toISOString()
		};

		saveResult(id, finalResult);
		updateJobState(id, 'imported', {
			strapiEntryId: resultEntry.id,
			strapiDocumentId: resultEntry.documentId,
			strapiAdminUrl: adminUrl
		});

		return json(finalResult);
	} catch (err) {
		const is401 = err && /** @type {any} */ (err).status === 401;
		const is404 = err && /** @type {any} */ (err).status === 404;
		const typeLabel = isSingleType ? 'Single Type' : 'Collection Type';
		const apiId = isSingleType ? schema.singularName : (schema.pluralName || `${schema.singularName}s`);

		let errMsg;
		if (is401) {
			errMsg = `Strapi authentication failed (401 Unauthorized: Missing or invalid credentials). Please verify that STRAPI_API_TOKEN in your .env file is valid and has Full Access permissions in Strapi Settings > API Tokens (or run "npm run strapi:token" if using local CMS).`;
		} else if (is404) {
			errMsg = `Strapi ${typeLabel} endpoint "/api/${endpoint}" was not found (404 Not Found). Please verify that the ${typeLabel.toLowerCase()} "${schema.displayName || schema.singularName}" exists (API ID: "${apiId}") and is accessible in your Strapi CMS.`;
		} else {
			errMsg = err instanceof Error ? err.message : String(err);
		}

		console.error(`[Import Error] Failed for job ${id}:`, {
			displayName: schema.displayName,
			category: typeLabel,
			apiId,
			strapiVersion: adapter.version,
			endpoint: `/api/${endpoint}`,
			method: isSingleType ? 'PUT' : 'POST',
			status: (err && /** @type {any} */ (err).status) || 500,
			message: errMsg
		});

		updateJobState(id, 'failed', { error: errMsg });
		return json(
			{
				error: {
					code: is401 ? 'STRAPI_UNAUTHORIZED' : is404 ? 'STRAPI_ENDPOINT_NOT_FOUND' : 'STRAPI_IMPORT_ERROR',
					message: errMsg,
					details: (err && /** @type {any} */ (err).details) || undefined
				}
			},
			{ status: (err && /** @type {any} */ (err).status) || 500 }
		);
	}
}
