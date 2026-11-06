import { generateSlug } from './slug.js';
import { normalizeKey } from '../document/intermediate.js';
import { getEmptyValueForField, tryParseJson } from './build-payload.js';

/**
 * Common semantic synonyms dictionary for document-to-schema field mapping.
 * @type {Record<string, string[]>}
 */
const SYNONYMS = {
	title: [
		'title',
		'headline',
		'heading',
		'article heading',
		'page title',
		'name',
		'post title',
		'article title',
		'header'
	],
	description: [
		'description',
		'summary',
		'overview',
		'excerpt',
		'meta description',
		'short description',
		'about',
		'lead',
		'intro',
		'introduction'
	],
	content: [
		'content',
		'body',
		'detailed article',
		'article',
		'body text',
		'main content',
		'story',
		'text',
		'full text'
	],
	body: [
		'body',
		'content',
		'detailed article',
		'article',
		'body text',
		'main content',
		'story',
		'text'
	],
	authorname: [
		'authorname',
		'author',
		'written by',
		'writer',
		'by',
		'contributor',
		'creator',
		'reporter'
	],
	authordesignation: [
		'authordesignation',
		'authordescription',
		'author designation',
		'author description',
		'designation',
		'role',
		'position',
		'job title',
		'profession',
		'specialist',
		'author role'
	],
	authorimage: [
		'authorimage',
		'image',
		'photo',
		'avatar',
		'headshot',
		'author photo',
		'picture'
	],
	coverimage: [
		'coverimage',
		'cover image',
		'featured image',
		'featuredimage',
		'cover',
		'banner',
		'header image',
		'thumbnail',
		'image'
	],
	shareimage: [
		'shareimage',
		'share image',
		'social image',
		'og image',
		'image',
		'preview image'
	],
	date: [
		'date',
		'publish date',
		'published date',
		'publisheddate',
		'created at',
		'post date',
		'release date'
	],
	time: [
		'time',
		'read time',
		'readtime',
		'reading time',
		'readingtime',
		'duration',
		'time to read'
	],
	buttontitle: [
		'buttontitle',
		'button title',
		'cta title',
		'ctatitle',
		'button text',
		'buttontext',
		'action text',
		'cta text',
		'button label'
	],
	buttonsubtitle: [
		'buttonsubtitle',
		'button subtitle',
		'cta subtitle',
		'ctasubtitle',
		'button description',
		'cta description'
	],
	buttonlink: [
		'buttonlink',
		'button link',
		'button url',
		'buttonurl',
		'cta link',
		'ctalink',
		'action url',
		'button',
		'link',
		'url'
	],
	keywords: ['keywords', 'tags', 'meta keywords', 'metakeywords', 'search terms'],
	metatitle: ['metatitle', 'meta title', 'seo title', 'seotitle', 'page title'],
	metadescription: [
		'metadescription',
		'meta description',
		'seo description',
		'seodescription'
	],
	structureddata: [
		'structureddata',
		'structured data',
		'structuredata',
		'structure data',
		'jsonld',
		'schema markup',
		'schema'
	],
	structuredata: [
		'structureddata',
		'structured data',
		'structuredata',
		'structure data',
		'jsonld',
		'schema markup',
		'schema'
	],
	metarobots: ['metarobots', 'meta robots', 'robots'],
	metaviewport: ['metaviewport', 'meta viewport', 'viewport'],
	canonicalurl: ['canonicalurl', 'canonical url', 'canonical link', 'canonical']
};

/**
 * Calculates a match score between a candidate document key and a target schema attribute.
 *
 * @param {string} candidateRawKey
 * @param {string} targetAttrName
 * @param {string} [sectionHeading='']
 * @param {string} [componentName='']
 * @returns {number} Score from 0.0 (no match) to 1.0 (exact match)
 */
function scoreMatch(candidateRawKey, targetAttrName, sectionHeading = '', componentName = '') {
	const normCand = normalizeKey(candidateRawKey);
	const normTarget = normalizeKey(targetAttrName);

	if (!normCand || !normTarget) return 0;

	// When searching for fields of a specific component, avoid stealing keys from unrelated sections or global scope
	if (componentName) {
		const normComp = normalizeKey(componentName);
		const normSec = normalizeKey(sectionHeading);
		const hasSectionAffinity = normSec && (normSec === normComp || normSec.includes(normComp) || normComp.includes(normSec));
		const hasPrefixAffinity = normCand.startsWith(normComp);
		if (!hasSectionAffinity && !hasPrefixAffinity) {
			return 0;
		}
	}

	// 1. Exact normalized match
	if (normCand === normTarget) {
		let score = 0.95;
		if (componentName && sectionHeading && normalizeKey(sectionHeading).includes(normalizeKey(componentName))) {
			score = 1.0;
		}
		return score;
	}

	// 2. Direct synonym match
	const synonyms = SYNONYMS[normTarget] || [];
	for (const syn of synonyms) {
		if (normCand === normalizeKey(syn)) {
			let score = 0.9;
			if (componentName && sectionHeading && normalizeKey(sectionHeading).includes(normalizeKey(componentName))) {
				score = 0.98;
			}
			return score;
		}
	}

	// 3. Substring containment
	if (normCand.includes(normTarget) || normTarget.includes(normCand)) {
		return 0.75;
	}

	// Check if candidate key matches any synonym substring
	for (const syn of synonyms) {
		const normSyn = normalizeKey(syn);
		if (normCand.includes(normSyn) || normSyn.includes(normCand)) {
			return 0.7;
		}
	}

	return 0;
}

/**
 * Cleans and formats a scalar value according to its Strapi attribute definition.
 *
 * @param {any} rawVal
 * @param {any} attrDef
 * @returns {any}
 */
function formatScalarValue(rawVal, attrDef) {
	if (rawVal === undefined || rawVal === null) return null;
	const str = String(rawVal).trim();
	if (!str) return attrDef.type === 'media' && attrDef.multiple ? [] : '';

	switch (attrDef.type) {
		case 'string':
		case 'email':
			// Strip HTML tags for simple string fields (e.g. <p>Title</p> -> Title)
			return str.replace(/<[^>]*>/g, '').trim();

		case 'text':
			if (str.includes('<table') || str.includes('<ul') || str.includes('<ol') || str.includes('<h')) {
				return str;
			}
			// Strip HTML tags for plain text / long text fields, converting paragraphs to newlines
			return str
				.replace(/<\/p>\s*<p>/gi, '\n\n')
				.replace(/<br\s*\/?>/gi, '\n')
				.replace(/<[^>]*>/g, '')
				.trim();

		case 'richtext':
		case 'blocks':
			// If already has HTML tags, return cleaned
			if (str.startsWith('<') && str.endsWith('>')) {
				return str;
			}
			return `<p>${str}</p>`;

		case 'number': {
			const cleaned = str.replace(/[^0-9.-]/g, '');
			const num = Number(cleaned);
			return isNaN(num) ? null : num;
		}

		case 'boolean': {
			const lower = str.toLowerCase();
			return lower === 'true' || lower === 'yes' || lower === '1';
		}

		case 'date': {
			// Extract YYYY-MM-DD if present
			const dateMatch = str.match(/\b\d{4}-\d{2}-\d{2}\b/);
			if (dateMatch) return dateMatch[0];
			const parsed = new Date(str);
			if (!isNaN(parsed.getTime())) {
				return parsed.toISOString().split('T')[0];
			}
			return str;
		}

		case 'json': {
			return tryParseJson(rawVal);
		}

		case 'enumeration': {
			const clean = str.replace(/<[^>]*>/g, '').trim();
			if (Array.isArray(attrDef.enum) && attrDef.enum.length > 0) {
				const exactMatch = attrDef.enum.find((e) => normalizeKey(e) === normalizeKey(clean));
				if (exactMatch) return exactMatch;

				// Check if any single enum value is distinctly mentioned in clean text (e.g. from template options)
				const cleanLower = clean.toLowerCase();
				const matchedOptions = attrDef.enum.filter((e) => {
					const normE = normalizeKey(e);
					return normE && cleanLower.includes(normE);
				});
				if (matchedOptions.length === 1) {
					return matchedOptions[0];
				}

				// If multiple options were listed (e.g. "Choose here: Plain / Download" template text)
				// use default if available
				if (matchedOptions.length > 1 && attrDef.default && attrDef.enum.includes(attrDef.default)) {
					return attrDef.default;
				}

				return clean || null;
			}
			return clean || null;
		}

		case 'media': {
			const matches = Array.from(str.matchAll(/img-\d+/g), (m) => m[0]);
			if (matches.length > 1) {
				return matches;
			}
			if (matches.length === 1) {
				return matches[0];
			}
			const clean = str.replace(/<[^>]*>/g, '').trim();
			return clean || null;
		}

		case 'uid': {
			const cleanStr = str.replace(/<[^>]*>/g, '').trim();
			return generateSlug(cleanStr);
		}

		default:
			return str;
	}
}

/**
 * Recursively maps component fields from raw field entries.
 * Supports:
 * - Direct scalar fields (string, text, media, number, etc.)
 * - Dotted nested keys (e.g. "button.name", "button.link", "Links.name")
 * - Nested single components recursively
 * - Preserving exact casing and field definitions
 *
 * @param {any} compSchema Normalized component schema
 * @param {Record<string, any>} fields Dictionary of raw keys -> values
 * @param {string} [contextName=''] Parent attribute or component name
 * @param {any} compSchema Normalized component schema
 * @param {Record<string, any>} fields Dictionary of raw keys -> values
 * @param {string} [contextName=''] Parent attribute or component name
 * @param {Set<string>} [consumedKeys=new Set()] Set of raw keys mapped
 * @param {any} [docContext=null] Optional full document context for nested components
 * @returns {Record<string, any>|null}
 */
function mapComponentObject(
	compSchema,
	fields,
	contextName = '',
	consumedKeys = new Set(),
	docContext = null
) {
	if (!compSchema || !compSchema.attributes) return null;

	const result = {};
	let hasAnyData = false;

	// Build normalized lookup
	const normFields = {};
	for (const [k, v] of Object.entries(fields)) {
		normFields[normalizeKey(k)] = { rawKey: k, value: v };
	}

	for (const [attrName, attr] of Object.entries(compSchema.attributes)) {
		if (attr.manualOnly) continue;

		const normAttr = normalizeKey(attrName);

		if (attr.type === 'component') {
			if (!attr.repeatable) {
				// Nested single component (e.g. "button" inside "cta" or "Links" inside "cards")
				const subFields = {};
				const prefixNorm = normAttr;

				for (const [fk, fv] of Object.entries(fields)) {
					const normFk = normalizeKey(fk);
					// Dotted key like "button.name" or "Links.name"
					if (fk.toLowerCase().startsWith(attrName.toLowerCase() + '.')) {
						const subKey = fk.slice(attrName.length + 1);
						subFields[subKey] = fv;
						consumedKeys.add(fk);
					} else if (normFk.startsWith(prefixNorm) && normFk.length > prefixNorm.length) {
						// Concatenated key like "buttonname"
						const subKey = fk.slice(prefixNorm.length);
						subFields[subKey] = fv;
						consumedKeys.add(fk);
					}
				}

				// If not found in fields, check docContext keyValues matching attrName
				if (Object.keys(subFields).length === 0 && docContext?.keyValues) {
					docContext.keyValues.forEach((kv, idx) => {
						if (docContext.mappedKvIndices?.has(idx)) return;
						const normSec = normalizeKey(kv.sectionHeading || kv.section || '');
						if (normSec && (normSec === normAttr || normSec.includes(normAttr) || normAttr.includes(normSec))) {
							subFields[kv.rawKey] = kv.value;
							if (docContext.mappedKvIndices) docContext.mappedKvIndices.add(idx);
							if (kv.blockId && docContext.mappedBlockIds) docContext.mappedBlockIds.add(kv.blockId);
						}
					});
				}

				if (Object.keys(subFields).length > 0) {
					const subObj = mapComponentObject(attr.schema, subFields, attrName, consumedKeys, docContext);
					if (subObj) {
						result[attrName] = subObj;
						hasAnyData = true;
					} else {
						result[attrName] = null;
					}
				} else {
					result[attrName] = null;
				}
			} else {
				// Nested repeatable component inside component (e.g. "metaSocial" inside "seo")
				const childItems = [];

				// 1. Check if fields[attrName] is already an array
				if (Array.isArray(fields[attrName])) {
					for (const rawItem of fields[attrName]) {
						const childConsumed = new Set();
						const mappedChild = mapComponentObject(attr.schema, rawItem, attrName, childConsumed, docContext);
						if (mappedChild) childItems.push(mappedChild);
					}
					consumedKeys.add(attrName);
				}

				// 2. Check docContext.repeatedGroups matching attrName (e.g. "metaSocial")
				if (childItems.length === 0 && docContext?.repeatedGroups) {
					const matchingRgIndex = docContext.repeatedGroups.findIndex((rg, rgIdx) => {
						if (docContext.mappedRepeatedGroupIndices?.has(rgIdx)) return false;
						const normHeading = normalizeKey(rg.sectionHeading);
						return Boolean(normHeading) && (normHeading === normAttr || normHeading.includes(normAttr) || normAttr.includes(normHeading));
					});

					if (matchingRgIndex !== -1) {
						const rg = docContext.repeatedGroups[matchingRgIndex];
						if (docContext.mappedRepeatedGroupIndices) {
							docContext.mappedRepeatedGroupIndices.add(matchingRgIndex);
						}
						for (const rec of rg.records || []) {
							const childFields = { ...(rec.rawFields || {}), ...rec.fields };
							const childConsumed = new Set();
							const mappedChild = mapComponentObject(attr.schema, childFields, attrName, childConsumed, docContext);
							if (mappedChild) {
								childItems.push(mappedChild);
							}
							if (rec.blockIds && docContext.mappedBlockIds) {
								for (const bId of rec.blockIds) docContext.mappedBlockIds.add(bId);
							}
						}
					}
				}

				// 3. Check docContext.keyValues matching attrName (single table entry for repeatable child component)
				if (childItems.length === 0 && docContext?.keyValues) {
					const childFields = {};
					const childBlockIds = [];
					docContext.keyValues.forEach((kv, idx) => {
						if (docContext.mappedKvIndices?.has(idx)) return;
						const normSec = normalizeKey(kv.sectionHeading || kv.section || '');
						if (normSec === normAttr || normSec.includes(normAttr) || normAttr.includes(normSec)) {
							childFields[kv.rawKey] = kv.value;
							if (kv.blockId) childBlockIds.push(kv.blockId);
							if (docContext.mappedKvIndices) docContext.mappedKvIndices.add(idx);
							if (kv.blockId && docContext.mappedBlockIds) docContext.mappedBlockIds.add(kv.blockId);
						}
					});

					if (Object.keys(childFields).length > 0) {
						const childConsumed = new Set();
						const mappedChild = mapComponentObject(attr.schema, childFields, attrName, childConsumed, docContext);
						if (mappedChild) {
							childItems.push(mappedChild);
							if (docContext.mappedBlockIds) {
								for (const bId of childBlockIds) docContext.mappedBlockIds.add(bId);
							}
						}
					}
				}

				// 4. Check dotted indexed keys in fields (e.g. metaSocial[0].title or metaSocial.0.title)
				if (childItems.length === 0) {
					const indexedBuckets = {};
					for (const [fk, fv] of Object.entries(fields)) {
						const match = fk.match(new RegExp(`^${attrName}[\\[\\._](\\d+)[\\]\\._](.+)$`, 'i'));
						if (match) {
							const idx = parseInt(match[1], 10);
							const prop = match[2];
							indexedBuckets[idx] = indexedBuckets[idx] || {};
							indexedBuckets[idx][prop] = fv;
							consumedKeys.add(fk);
						}
					}
					const sortedIndices = Object.keys(indexedBuckets).map(Number).sort((a, b) => a - b);
					for (const idx of sortedIndices) {
						const childConsumed = new Set();
						const mappedChild = mapComponentObject(attr.schema, indexedBuckets[idx], attrName, childConsumed, docContext);
						if (mappedChild) {
							childItems.push(mappedChild);
						}
					}
				}

				result[attrName] = childItems;
				if (childItems.length > 0) {
					hasAnyData = true;
				}
			}
		} else {
			// Scalar / Media field
			// 1. Exact match on raw key (case-sensitive)
			let val = fields[attrName];
			let matchedKey = val !== undefined ? attrName : null;

			// 2. Case-insensitive normalized match
			if (val === undefined && normFields[normAttr]) {
				val = normFields[normAttr].value;
				matchedKey = normFields[normAttr].rawKey;
			}

			// 3. Synonym matching
			if (val === undefined) {
				const syns = SYNONYMS[normAttr] || [];
				for (const s of syns) {
					const normS = normalizeKey(s);
					if (normFields[normS]) {
						val = normFields[normS].value;
						matchedKey = normFields[normS].rawKey;
						break;
					}
				}
			}

			// 4. Substring or partial match
			if (val === undefined) {
				for (const [fk, fv] of Object.entries(fields)) {
					if (normalizeKey(fk) === normAttr || normalizeKey(fk).endsWith(`.${normAttr}`)) {
						val = fv;
						matchedKey = fk;
						break;
					}
				}
			}

			if (matchedKey) {
				consumedKeys.add(matchedKey);
			}

			if (val !== undefined && val !== null && val !== '') {
				result[attrName] = formatScalarValue(val, attr);
				hasAnyData = true;
			} else {
				result[attrName] = getEmptyValueForField(attr);
			}
		}
	}

	return hasAnyData ? result : null;
}

/**
 * Semantic document-to-schema mapping engine.
 *
 * Implements:
 * - Rule A: Schema field exists + document content exists -> populated accurately
 * - Rule B: Schema field exists + document content missing -> clean empty typed value
 * - Rule C: Document content exists + schema field missing -> recorded in unmapped array
 * - Rule D: Ambiguities detected -> recorded in warnings
 *
 * @param {object} params
 * @param {any} params.intermediateDoc Output of extractIntermediateDocument
 * @param {import('../document/model.js').DocumentModel} params.documentModel Original doc model
 * @param {any} params.contentTypeDef Target normalized content type schema
 * @returns {{
 *   data: Record<string, any>,
 *   fieldNotes: any[],
 *   warnings: string[],
 *   unmapped: any[],
 *   issues: any[]
 * }}
 */
export function mapDocumentToSchema({ intermediateDoc, documentModel, contentTypeDef }) {
	const data = {};
	/** @type {any[]} */
	const fieldNotes = [];
	/** @type {string[]} */
	const warnings = [];
	/** @type {any[]} */
	const unmapped = [];
	/** @type {any[]} */
	const issues = [];

	const mappedBlockIds = new Set();
	const mappedKvIndices = new Set();
	const mappedRepeatedGroupIndices = new Set();

	const attributes = contentTypeDef?.attributes || {};
	const keyValues = intermediateDoc.keyValues || [];
	const repeatedGroups = intermediateDoc.repeatedGroups || [];
	const sections = intermediateDoc.sections || [];
	const blocks = documentModel.blocks || [];
	const docImages = documentModel.images || [];

	const docContext = {
		keyValues,
		repeatedGroups,
		sections,
		blocks,
		images: docImages,
		mappedKvIndices,
		mappedBlockIds,
		mappedRepeatedGroupIndices
	};

	// Helper to find best key-value match
	function findBestKv(targetAttrName, preferredSection = '', componentName = '') {
		let bestMatch = null;
		let bestScore = 0;
		let bestIndex = -1;

		for (let i = 0; i < keyValues.length; i++) {
			const kv = keyValues[i];
			const score = scoreMatch(kv.rawKey, targetAttrName, kv.sectionHeading, componentName);

			// Section affinity boost
			let totalScore = score;
			if (
				preferredSection &&
				kv.sectionHeading &&
				normalizeKey(kv.sectionHeading).includes(normalizeKey(preferredSection))
			) {
				totalScore += 0.1;
			}

			if (totalScore > bestScore && totalScore >= 0.65) {
				bestScore = totalScore;
				bestMatch = kv;
				bestIndex = i;
			}
		}

		if (bestMatch && bestIndex !== -1) {
			mappedKvIndices.add(bestIndex);
			if (bestMatch.blockId) mappedBlockIds.add(bestMatch.blockId);
			return { match: bestMatch, score: bestScore };
		}
		return null;
	}

	// 1. Process Top-Level Scalar Attributes
	for (const [attrName, attr] of Object.entries(attributes)) {
		if (attr.manualOnly) continue;
		if (attr.type === 'component' || attr.type === 'dynamiczone') continue;

		// Try to find matching key-value pair first
		const kvResult = findBestKv(attrName);
		if (kvResult && kvResult.match.value !== '') {
			const formattedVal = formatScalarValue(kvResult.match.value, attr);
			data[attrName] = formattedVal;
			fieldNotes.push({
				field: attrName,
				path: attrName,
				status: 'found',
				confidence: Math.min(1.0, kvResult.score),
				sourceBlockIds: kvResult.match.blockId ? [kvResult.match.blockId] : [],
				note: `Mapped from document table/field "${kvResult.match.rawKey}"`
			});
			continue;
		}

		// Fallback for Title
		if (attrName === 'title' || attrName === 'name') {
			const h1Block =
				blocks.find((b) => b.type === 'heading' && b.level === 1) ||
				blocks.find((b) => b.type === 'heading') ||
				blocks.find((b) => b.type === 'paragraph');

			if (h1Block && h1Block.text?.trim()) {
				data[attrName] = h1Block.text.trim();
				mappedBlockIds.add(h1Block.id);
				fieldNotes.push({
					field: attrName,
					path: attrName,
					status: 'found',
					confidence: 0.85,
					sourceBlockIds: [h1Block.id],
					note: 'Extracted from document heading'
				});
				continue;
			}
		}

		// Fallback for Slug / UID
		if (attr.type === 'uid') {
			if (data.title || data.name) {
				data[attrName] = generateSlug(data.title || data.name);
				fieldNotes.push({
					field: attrName,
					path: attrName,
					status: 'found',
					confidence: 0.95,
					sourceBlockIds: [],
					note: 'Auto-generated slug from title'
				});
				continue;
			}
		}

		// Fallback for Body / Content / Description from paragraphs
		if (
			(attr.type === 'blocks' || attr.type === 'richtext' || attrName === 'body') &&
			!data[attrName]
		) {
			// Find body paragraphs not already claimed
			const bodyParagraphs = [];
			for (const sec of sections) {
				// Avoid sections meant for SEO, components, authors
				const normHeading = normalizeKey(sec.heading);
				if (
					normHeading.includes('seo') ||
					normHeading.includes('author') ||
					normHeading.includes('faq') ||
					normHeading.includes('button')
				) {
					continue;
				}
				for (const p of sec.paragraphs) {
					if (!mappedBlockIds.has(p.blockId)) {
						bodyParagraphs.push(p);
					}
				}
			}

			if (bodyParagraphs.length > 0) {
				data[attrName] = bodyParagraphs.map((p) => p.html || `<p>${p.text}</p>`).join('\n');
				for (const p of bodyParagraphs) mappedBlockIds.add(p.blockId);
				fieldNotes.push({
					field: attrName,
					path: attrName,
					status: 'found',
					confidence: 0.8,
					sourceBlockIds: bodyParagraphs.map((p) => p.blockId),
					note: 'Extracted main content paragraphs'
				});
				continue;
			}
		}

		// Fallback for Media (coverImage, featuredImage, etc.)
		if (attr.type === 'media') {
			if (docImages.length > 0) {
				// Match first unclaimed image
				data[attrName] = docImages[0].id;
				fieldNotes.push({
					field: attrName,
					path: attrName,
					status: 'found',
					confidence: 0.9,
					sourceBlockIds: [],
					note: `Associated document image ${docImages[0].id}`
				});
				continue;
			}
		}

		// Rule B: Field exists in schema, but missing in document -> clean empty typed value
		data[attrName] = getEmptyValueForField(attr);
		fieldNotes.push({
			field: attrName,
			path: attrName,
			status: 'missing',
			value: null,
			confidence: 0,
			sourceBlockIds: [],
			note: attr.required
				? `Required field "${attrName}" was not found in document`
				: `Field "${attrName}" not found in document (will remain empty in Strapi)`
		});

		if (attr.required) {
			warnings.push(`Required field "${attrName}" was not found in document.`);
		}
	}

	// 2. Process Single Components (e.g. seo, AuthorData, HeroSection, Banner)
	for (const [attrName, attr] of Object.entries(attributes)) {
		if (attr.type !== 'component' || attr.repeatable || !attr.schema) continue;

		const compSchema = attr.schema;
		const compAttributes = compSchema.attributes || {};
		const compBlockIds = [];
		const compFields = {};
		const normAttr = normalizeKey(attrName);

		// First, collect all KVs that belong to this component section or are prefixed with attrName
		keyValues.forEach((kv, idx) => {
			const rawSec = kv.section || kv.sectionHeading || '';
			const normSec = normalizeKey(rawSec);
			const isSectionMatch = Boolean(normSec) && (normSec === normAttr || normSec.includes(normAttr) || normAttr.includes(normSec));
			const isPrefixed = kv.rawKey.toLowerCase().startsWith(attrName.toLowerCase() + '.');

			if (isSectionMatch || isPrefixed) {
				const fieldKey = isPrefixed ? kv.rawKey.slice(attrName.length + 1) : kv.rawKey;
				compFields[fieldKey] = kv.value;
				if (kv.blockId) compBlockIds.push(kv.blockId);
				mappedKvIndices.add(idx);
				if (kv.blockId) mappedBlockIds.add(kv.blockId);
			}
		});

		// Fallback for fields not found in section: check findBestKv ONLY if component was matched in document
		if (Object.keys(compFields).length > 0) {
			for (const [subName, subAttr] of Object.entries(compAttributes)) {
				if (subAttr.manualOnly) continue;
				if (compFields[subName] === undefined && compFields[normalizeKey(subName)] === undefined) {
					const matchRes = findBestKv(subName, attrName, attrName);
					if (matchRes && matchRes.match.value !== '') {
						compFields[subName] = matchRes.match.value;
						if (matchRes.match.blockId) {
							compBlockIds.push(matchRes.match.blockId);
							mappedBlockIds.add(matchRes.match.blockId);
						}
					}
				}
			}
		}

		const consumed = new Set();
		const mappedObj = mapComponentObject(compSchema, compFields, attrName, consumed, docContext);

		if (mappedObj) {
			data[attrName] = mappedObj;
			for (const bId of compBlockIds) mappedBlockIds.add(bId);
			fieldNotes.push({
				field: attrName,
				path: attrName,
				status: 'found',
				confidence: 0.9,
				sourceBlockIds: [...new Set(compBlockIds)],
				note: `Mapped single component "${attrName}"`
			});
		} else {
			// Rule B: single component not in document is null
			data[attrName] = null;
			fieldNotes.push({
				field: attrName,
				path: attrName,
				status: 'missing',
				value: null,
				confidence: 0,
				sourceBlockIds: [],
				note: attr.required
					? `Required component "${attrName}" was not found in document`
					: `Single component "${attrName}" not found in document (will remain empty in Strapi)`
			});
			if (attr.required) {
				warnings.push(`Required component "${attrName}" was not found in document.`);
			}
		}
	}

	// 3. Process Repeatable Components (e.g. contentNew, services, faqs, cta, cards)
	for (const [attrName, attr] of Object.entries(attributes)) {
		if (attr.type !== 'component' || !attr.repeatable || !attr.schema) continue;

		const compSchema = attr.schema;
		const compAttributes = compSchema.attributes || {};
		const items = [];
		const compBlockIds = [];

		// Check if a repeated group exists whose section heading matches attrName
		const normAttrName = normalizeKey(attrName);
		const serviceSynonyms = [
			'services',
			'offerings',
			'what we do',
			'our expertise',
			'services we offer',
			'core offerings',
			'our core offerings',
			'service',
			'capabilities'
		];
		const faqSynonyms = [
			'faq',
			'faqs',
			'frequently asked questions',
			'questions and answers',
			'questions',
			'common inquiries',
			'q&a',
			'inquiries'
		];

		let matchingGroup = repeatedGroups.find((rg) => {
			const normHeading = normalizeKey(rg.sectionHeading);
			if (!normHeading) return false;
			if (normHeading.includes(normAttrName) || normAttrName.includes(normHeading)) {
				return true;
			}
			if (normAttrName.includes('service')) {
				return serviceSynonyms.some((s) => normHeading.includes(normalizeKey(s)));
			}
			if (normAttrName.includes('faq')) {
				return faqSynonyms.some((s) => normHeading.includes(normalizeKey(s)));
			}
			return false;
		});

		// Check synonyms for generic repeated groups (faqs, services, etc.)
		if (!matchingGroup) {
			const isFaq =
				normAttrName.includes('faq') ||
				Object.keys(compAttributes).some((k) => k.includes('question'));
			if (isFaq) {
				matchingGroup = repeatedGroups.find(
					(rg) =>
						rg.isFaq ||
						faqSynonyms.some((s) => normalizeKey(rg.sectionHeading).includes(normalizeKey(s)))
				);
			}
		}

		if (!matchingGroup && repeatedGroups.length > 0) {
			// If only one repeated group exists and no other repeatable components, match it
			const repeatableAttrs = Object.values(attributes).filter(
				(a) => a.type === 'component' && a.repeatable
			);
			if (repeatableAttrs.length === 1 && repeatedGroups.length === 1) {
				matchingGroup = repeatedGroups[0];
			}
		}

		if (matchingGroup && matchingGroup.records) {
			const rgIdx = repeatedGroups.indexOf(matchingGroup);
			if (rgIdx !== -1) mappedRepeatedGroupIndices.add(rgIdx);
			for (const rec of matchingGroup.records) {
				const fieldsToMap = { ...(rec.rawFields || {}), ...rec.fields };
				const consumed = new Set();
				const itemData = mapComponentObject(compSchema, fieldsToMap, attrName, consumed, docContext);

				if (itemData) {
					items.push(itemData);
					if (rec.blockIds) compBlockIds.push(...rec.blockIds);
				}
			}
		}

		// Fallback for single table or keyValues belonging to this repeatable component (e.g. single entry "seo")
		if (items.length === 0) {
			const compFields = {};
			keyValues.forEach((kv, idx) => {
				const normSec = normalizeKey(kv.section || kv.sectionHeading || '');
				const isSectionMatch =
					normSec === normAttrName ||
					normSec.includes(normAttrName) ||
					normAttrName.includes(normSec);
				const isPrefixed = kv.rawKey.toLowerCase().startsWith(attrName.toLowerCase() + '.');

				if (isSectionMatch || isPrefixed) {
					const fieldKey = isPrefixed ? kv.rawKey.slice(attrName.length + 1) : kv.rawKey;
					compFields[fieldKey] = kv.value;
					if (kv.blockId) compBlockIds.push(kv.blockId);
					mappedKvIndices.add(idx);
					if (kv.blockId) mappedBlockIds.add(kv.blockId);
				}
			});

			if (Object.keys(compFields).length > 0) {
				const consumed = new Set();
				const mappedItem = mapComponentObject(compSchema, compFields, attrName, consumed, docContext);
				if (mappedItem) {
					items.push(mappedItem);
				}
			}
		}

		// Fallback for FAQ or Services from bullet lists / headings if repeatedGroups didn't catch it
		if (items.length === 0) {
			const isFaq =
				normAttrName.includes('faq') ||
				Object.keys(compAttributes).some((k) => k.includes('question'));

			if (isFaq) {
				for (const sec of sections) {
					if (normalizeKey(sec.heading).includes('faq') || normalizeKey(sec.heading).includes('question')) {
						for (let i = 0; i < sec.paragraphs.length - 1; i += 2) {
							const q = sec.paragraphs[i];
							const a = sec.paragraphs[i + 1];
							items.push({
								question: q.text.replace(/^[Qq]:\s*/, ''),
								answer: a.text.replace(/^[Aa]:\s*/, '')
							});
							compBlockIds.push(q.blockId, a.blockId);
						}
					}
				}
			}
		}

		if (items.length > 0) {
			data[attrName] = items;
			for (const bId of compBlockIds) mappedBlockIds.add(bId);
			fieldNotes.push({
				field: attrName,
				path: attrName,
				status: 'found',
				confidence: 0.85,
				sourceBlockIds: [...new Set(compBlockIds)],
				note: `Extracted ${items.length} repeatable items for "${attrName}"`
			});
		} else {
			// Rule B: empty array
			data[attrName] = [];
			fieldNotes.push({
				field: attrName,
				path: attrName,
				status: 'missing',
				value: [],
				confidence: 0,
				sourceBlockIds: [],
				note: attr.required
					? `Required repeatable component "${attrName}" has no matching content`
					: `Repeatable component "${attrName}" not found in document (will remain empty in Strapi)`
			});
			if (attr.required) {
				warnings.push(`Required repeatable component "${attrName}" has no matching content.`);
			}
		}
	}

	// 4. Rule C: Identify extra document content that was NOT mapped to any schema attribute
	for (let i = 0; i < keyValues.length; i++) {
		if (!mappedKvIndices.has(i)) {
			const kv = keyValues[i];
			// Ignore if it's explicitly instruction text like "leave empty"
			const valLower = (kv.value || '').toLowerCase();
			const isExplicitIgnoreInstruction =
				valLower.includes('leave empty') || valLower.includes('configure the correct');

			unmapped.push({
				blockIds: kv.blockId ? [kv.blockId] : [],
				text: `${kv.rawKey} | ${kv.value.slice(0, 100)}`,
				reason: isExplicitIgnoreInstruction
					? `Document field marked as optional template instruction`
					: `Document field "${kv.rawKey}" not present in selected Strapi schema (safely ignored)`
			});
		}
	}

	// Helper to check if a section heading matches any top-level or recursively nested component attribute
	function matchesAnySchema(attrMap) {
		for (const [aName, aDef] of Object.entries(attrMap || {})) {
			const normA = normalizeKey(aName);
			if (normHeading.includes(normA) || normA.includes(normHeading)) return true;
			if (aDef?.type === 'component' && aDef?.schema?.attributes) {
				if (matchesAnySchema(aDef.schema.attributes)) return true;
			}
		}
		return false;
	}

	// Unmapped paragraphs from extra sections
	let normHeading = '';
	for (const sec of sections) {
		normHeading = normalizeKey(sec.heading);
		if (!normHeading) continue;

		// Check if any schema attribute (top-level or component) matches this section
		const schemaHasSection = matchesAnySchema(attributes);

		if (!schemaHasSection) {
			for (const p of sec.paragraphs) {
				if (!mappedBlockIds.has(p.blockId)) {
					unmapped.push({
						blockIds: [p.blockId],
						text: p.text.slice(0, 100),
						reason: `Document section "${sec.heading}" not present in selected Strapi schema (safely ignored)`
					});
				}
			}
		}
	}

	return {
		data,
		fieldNotes,
		warnings,
		unmapped,
		issues
	};
}
