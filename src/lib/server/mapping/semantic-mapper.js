import { generateSlug } from './slug.js';
import { normalizeKey } from '../document/intermediate.js';

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
	if (!str) return '';

	switch (attrDef.type) {
		case 'string':
		case 'email':
			// Strip HTML tags for simple string fields (e.g. <p>Title</p> -> Title)
			return str.replace(/<[^>]*>/g, '').trim();

		case 'text':
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
			if (typeof rawVal === 'object' && rawVal !== null) return rawVal;
			const cleanStr = str.replace(/<[^>]*>/g, '').trim();
			try {
				return JSON.parse(cleanStr);
			} catch {
				try {
					return JSON.parse(str);
				} catch {
					return str;
				}
			}
		}

		case 'enumeration': {
			if (Array.isArray(attrDef.enum) && attrDef.enum.length > 0) {
				const match = attrDef.enum.find((e) => normalizeKey(e) === normalizeKey(str));
				return match || str;
			}
			return str;
		}

		case 'media': {
			// Extract img-X
			const imgMatch = str.match(/img-\d+/);
			if (imgMatch) return imgMatch[0];
			return str || null;
		}

		case 'uid':
			return generateSlug(str);

		default:
			return str;
	}
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

	const attributes = contentTypeDef?.attributes || {};
	const keyValues = intermediateDoc.keyValues || [];
	const repeatedGroups = intermediateDoc.repeatedGroups || [];
	const sections = intermediateDoc.sections || [];
	const blocks = documentModel.blocks || [];
	const docImages = documentModel.images || [];

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
				path: attrName,
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
					path: attrName,
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
					path: attrName,
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
					path: attrName,
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
					path: attrName,
					confidence: 0.9,
					sourceBlockIds: [],
					note: `Associated document image ${docImages[0].id}`
				});
				continue;
			}
		}

		// Rule B: Field exists in schema, but missing in document -> clean empty typed value
		if (attr.type === 'string' || attr.type === 'text' || attr.type === 'blocks' || attr.type === 'richtext') {
			data[attrName] = '';
		} else {
			data[attrName] = null;
		}

		if (attr.required) {
			warnings.push(`Required field "${attrName}" was not found in document.`);
		}
	}

	// 2. Process Single Components (e.g. seo, AuthorData)
	for (const [attrName, attr] of Object.entries(attributes)) {
		if (attr.type !== 'component' || attr.repeatable || !attr.schema) continue;

		const compSchema = attr.schema;
		const compAttributes = compSchema.attributes || {};
		const compData = {};
		let hasAnyField = false;
		const compBlockIds = [];

		for (const [subName, subAttr] of Object.entries(compAttributes)) {
			if (subAttr.manualOnly) continue;

			// Look for matching KV inside section matching component name or globally
			const matchRes = findBestKv(subName, attrName, attrName);
			if (matchRes && matchRes.match.value !== '') {
				compData[subName] = formatScalarValue(matchRes.match.value, subAttr);
				hasAnyField = true;
				if (matchRes.match.blockId) compBlockIds.push(matchRes.match.blockId);
				fieldNotes.push({
					path: `${attrName}.${subName}`,
					confidence: Math.min(1.0, matchRes.score),
					sourceBlockIds: matchRes.match.blockId ? [matchRes.match.blockId] : [],
					note: `Mapped component field "${attrName}.${subName}" from "${matchRes.match.rawKey}"`
				});
			} else {
				// Empty typed representation
				if (subAttr.type === 'string' || subAttr.type === 'text') {
					compData[subName] = '';
				} else {
					compData[subName] = null;
				}
				if (subAttr.required) {
					warnings.push(`Required component field "${attrName}.${subName}" was not found.`);
				}
			}
		}

		if (hasAnyField) {
			data[attrName] = compData;
		} else {
			// Rule B: single component not in document is null
			data[attrName] = null;
			if (attr.required) {
				warnings.push(`Required component "${attrName}" was not found in document.`);
			}
		}
	}

	// 3. Process Repeatable Components (e.g. contentNew, services, faqs)
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
			for (const rec of matchingGroup.records) {
				const itemData = {};
				let itemHasContent = false;

				for (const [subName, subAttr] of Object.entries(compAttributes)) {
					const normSub = normalizeKey(subName);
					let matchedVal = rec.fields[normSub];

					// Check synonyms for subfields
					if (matchedVal === undefined) {
						if (normSub === 'title') {
							matchedVal = rec.fields['service'] || rec.fields['offering'] || rec.fields['name'];
						}
						const subSyns = SYNONYMS[normSub] || [];
						for (const s of subSyns) {
							if (matchedVal !== undefined) break;
							if (rec.fields[normalizeKey(s)] !== undefined) {
								matchedVal = rec.fields[normalizeKey(s)];
								break;
							}
						}
					}

					// Fallback: match by partial key
					if (matchedVal === undefined) {
						for (const [fk, fv] of Object.entries(rec.fields)) {
							if (fk.includes(normSub) || normSub.includes(fk)) {
								matchedVal = fv;
								break;
							}
						}
					}

					if (matchedVal !== undefined && matchedVal !== '') {
						itemData[subName] = formatScalarValue(matchedVal, subAttr);
						itemHasContent = true;
					} else {
						itemData[subName] = subAttr.type === 'string' || subAttr.type === 'text' ? '' : null;
					}
				}

				if (itemHasContent) {
					items.push(itemData);
					if (rec.blockIds) compBlockIds.push(...rec.blockIds);
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
				path: attrName,
				confidence: 0.85,
				sourceBlockIds: [...new Set(compBlockIds)],
				note: `Extracted ${items.length} repeatable items for "${attrName}"`
			});
		} else {
			// Rule B: empty array
			data[attrName] = [];
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

	// Unmapped paragraphs from extra sections
	for (const sec of sections) {
		const normHeading = normalizeKey(sec.heading);
		if (!normHeading) continue;

		// Check if any schema attribute matches this section
		const schemaHasSection = Object.keys(attributes).some((a) => {
			const normA = normalizeKey(a);
			return normHeading.includes(normA) || normA.includes(normHeading);
		});

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
