import { htmlToStrapiBlocks } from './blocks.js';
import { htmlToMarkdown } from './richtext.js';
import { generateSlug } from './slug.js';

function normalizeKey(str) {
	return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Safely parses a string or value into JSON, handling HTML entities, smart quotes,
 * and Word document export artifacts. If parsing fails, returns null.
 *
 * @param {any} raw
 * @returns {any}
 */
export function tryParseJson(raw) {
	if (!raw) return null;
	if (typeof raw === 'object') return raw;
	if (typeof raw !== 'string') return null;

	const trimmed = raw.trim();
	if (!trimmed) return null;

	// 1. Direct parse attempt
	try {
		return JSON.parse(trimmed);
	} catch {
		// continue to cleaned attempt
	}

	// 2. Clean HTML formatting (e.g. from Word/Mammoth HTML export)
	let str = trimmed
		.replace(/&nbsp;/gi, ' ')
		.replace(/&(quot|ldquo|rdquo);/gi, '"')
		.replace(/&(apos|lsquo|rsquo);/gi, "'")
		.replace(/&#8220;|&#8221;/g, '"')
		.replace(/&#8216;|&#8217;/g, "'")
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
		.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");

	// Replace <a> tags while keeping inner text (cleaning out any trailing quote/percent encoding)
	str = str.replace(/<a\b[^>]*>(.*?)<\/a>/gi, (m, inner) => inner.replace(/(%22|")+$/g, ''));

	// Strip remaining HTML tags
	str = str.replace(/<[^>]*>/g, ' ');

	// Fix duplicate quotes: e.g. ""https://..."" -> "https://..."
	str = str.replace(/([^"\s,:[{\]])""+/g, '$1"');
	str = str.replace(/%22"/g, '"');

	// Fix trailing commas before } or ]
	str = str.replace(/,\s*([}\]])/g, '$1');

	str = str.trim();

	try {
		return JSON.parse(str);
	} catch {
		return null;
	}
}

/**
 * Returns the correct empty/clearing value for a Strapi attribute based on its type.
 * Ensures that absent document fields are explicitly cleared rather than retaining stale Strapi data.
 *
 * @param {any} attr Attribute definition from normalized schema
 * @param {any} [adapter] Strapi version adapter
 * @returns {any}
 */
export function getEmptyValueForField(attr, adapter) {
	if (!attr) return null;

	switch (attr.type) {
		case 'component':
			return attr.repeatable ? [] : null;

		case 'dynamiczone':
			return [];

		case 'media':
			return attr.multiple ? [] : null;

		case 'relation': {
			const isMultiple =
				attr.relation === 'oneToMany' ||
				attr.relation === 'manyToMany' ||
				attr.multiple;
			if (isMultiple) {
				return adapter?.version === '5' ? { set: [] } : [];
			}
			return null;
		}

		case 'number':
		case 'boolean':
		case 'json':
		case 'date':
		case 'enumeration':
		case 'string':
		case 'text':
		case 'richtext':
		case 'blocks':
		case 'email':
		case 'uid':
		default:
			return null;
	}
}

/**
 * Recursively maps and whitelists reviewed form data into a Strapi-ready payload.
 *
 * CRITICAL RULE:
 * The uploaded document is the sole source of truth for values.
 * Every relevant field in the live Strapi schema is evaluated:
 * - If data exists in document -> mapped and imported.
 * - If data is absent from document -> set to the correct typed empty clearing value (null / []).
 * Existing Strapi values are NEVER used as fallbacks.
 *
 * @param {any} rawData The user-reviewed content data (from document extraction)
 * @param {any} contentTypeDef Normalized schema definition from live Strapi
 * @param {any} adapter Strapi version adapter
 * @param {object} [options]
 * @param {boolean} [options.isUpdate=false]
 * @returns {{ payload: any, warnings: string[] }}
 */
export function buildStrapiPayload(rawData, contentTypeDef, adapter, options = {}) {
	const warnings = [];
	const payload = {};
	const attributes = contentTypeDef?.attributes || {};

	for (const [key, attr] of Object.entries(attributes)) {
		if (attr.manualOnly) continue;

		const value = rawData?.[key];

		// Detect if field is missing or empty in the document mapping
		const isValueMissing =
			value === undefined ||
			value === null ||
			value === '' ||
			(Array.isArray(value) &&
				value.length === 0 &&
				attr.type !== 'dynamiczone' &&
				attr.type !== 'component' &&
				attr.type !== 'media');

		if (isValueMissing) {
			if (attr.required && !options.isUpdate) {
				warnings.push(`Required field "${key}" was not found in document.`);
			}
			// Missing optional fields receive their correct empty clearing representation
			payload[key] = getEmptyValueForField(attr, adapter);
			continue;
		}

		switch (attr.type) {
			case 'string':
			case 'email': {
				const str = String(value).trim();
				if (attr.maxLength && str.length > attr.maxLength) {
					warnings.push(
						`Field "${key}" length (${str.length}) exceeds maximum of ${attr.maxLength}.`
					);
				}
				payload[key] = str || null;
				break;
			}

			case 'text': {
				const str = String(value).trim();
				payload[key] = str || null;
				break;
			}

			case 'uid': {
				let slug = String(value).trim();
				if (!slug && attr.targetField && rawData[attr.targetField]) {
					slug = generateSlug(rawData[attr.targetField]);
				}
				payload[key] = slug || null;
				break;
			}

			case 'blocks': {
				if (typeof value === 'string' && value.trim()) {
					payload[key] = htmlToStrapiBlocks(value);
				} else if (Array.isArray(value) && value.length > 0) {
					payload[key] = value;
				} else {
					payload[key] = null;
				}
				break;
			}

			case 'richtext': {
				if (typeof value === 'string' && value.trim()) {
					payload[key] = htmlToMarkdown(value);
				} else if (value) {
					payload[key] = value;
				} else {
					payload[key] = null;
				}
				break;
			}

			case 'number': {
				const num = Number(value);
				payload[key] = isNaN(num) ? null : num;
				break;
			}

			case 'boolean': {
				if (typeof value === 'boolean') {
					payload[key] = value;
				} else if (value === 'true' || value === 1 || value === '1') {
					payload[key] = true;
				} else if (value === 'false' || value === 0 || value === '0') {
					payload[key] = false;
				} else {
					payload[key] = null;
				}
				break;
			}

			case 'json': {
				if (typeof value === 'object' && value !== null) {
					payload[key] = value;
				} else if (typeof value === 'string' && value.trim()) {
					const parsed = tryParseJson(value);
					if (parsed !== null) {
						payload[key] = parsed;
					} else {
						// Critical: Invalid JSON strings must NOT be sent to Strapi JSON columns
						// as Postgres/MySQL throws syntax errors resulting in 500 Internal Server Error.
						warnings.push(`Field "${key}" contained invalid JSON syntax and was safely cleared to null.`);
						payload[key] = null;
					}
				} else {
					payload[key] = null;
				}
				break;
			}

			case 'date': {
				const str = String(value).trim();
				payload[key] = str || null;
				break;
			}

			case 'enumeration': {
				const str = String(value).trim();
				if (Array.isArray(attr.enum) && attr.enum.length > 0) {
					const exact = attr.enum.find((e) => e === str || normalizeKey(e) === normalizeKey(str));
					if (exact) {
						payload[key] = exact;
					} else {
						const cleanLower = str.toLowerCase();
						const matchedOptions = attr.enum.filter((e) => {
							const normE = normalizeKey(e);
							return normE && cleanLower.includes(normE);
						});
						if (matchedOptions.length === 1) {
							payload[key] = matchedOptions[0];
						} else if (matchedOptions.length > 1 && attr.default && attr.enum.includes(attr.default)) {
							payload[key] = attr.default;
						} else if (str) {
							payload[key] = str;
						} else {
							payload[key] = null;
						}
					}
				} else {
					payload[key] = str || null;
				}
				break;
			}

			case 'media': {
				if (Array.isArray(value)) {
					const validMedia = value.filter(
						(v) => v !== null && v !== undefined && v !== '' && !String(v).startsWith('img-')
					);
					payload[key] = validMedia.length > 0 ? validMedia : [];
				} else if (typeof value === 'object' && value?.$docImage) {
					payload[key] = null;
				} else if (typeof value === 'number') {
					payload[key] = value;
				} else if (
					typeof value === 'string' &&
					value.trim() &&
					!value.startsWith('img-')
				) {
					payload[key] = value.trim();
				} else {
					payload[key] = attr.multiple ? [] : null;
				}
				break;
			}

			case 'relation': {
				if (value) {
					payload[key] = adapter.formatRelation(value);
				} else {
					payload[key] = getEmptyValueForField(attr, adapter);
				}
				break;
			}

			case 'component': {
				if (attr.repeatable) {
					if (Array.isArray(value) && value.length > 0) {
						payload[key] = value.map((item) => {
							const { payload: compPayload } = buildStrapiPayload(
								item,
								attr.schema,
								adapter,
								options
							);
							// Strip out client-side synthetic id
							delete compPayload.id;
							return compPayload;
						});
					} else {
						// Missing or empty repeatable component is cleared
						payload[key] = [];
					}
				} else if (typeof value === 'object' && value !== null) {
					// Check if all fields inside the single component are empty
					const hasAnyData = Object.values(value).some(
						(v) =>
							v !== null &&
							v !== undefined &&
							v !== '' &&
							(!Array.isArray(v) || v.length > 0)
					);

					if (hasAnyData) {
						const { payload: compPayload } = buildStrapiPayload(
							value,
							attr.schema,
							adapter,
							options
						);
						delete compPayload.id;

						// Check if any sub-attribute has an unmet min requirement (e.g. Polldata options with min: 2)
						let hasUnmetMinRequirement = false;
						if (attr.schema?.attributes) {
							for (const [subKey, subAttr] of Object.entries(attr.schema.attributes)) {
								if (subAttr.repeatable && subAttr.min && subAttr.min > 0) {
									const subVal = compPayload[subKey];
									if (!Array.isArray(subVal) || subVal.length < subAttr.min) {
										hasUnmetMinRequirement = true;
										break;
									}
								}
							}
						}

						if (hasUnmetMinRequirement) {
							// If a component contains a repeatable sub-field that requires a minimum number of items
							// but the document did not provide them, we cannot create an invalid partial component.
							// Setting to null cleanly clears it in Strapi.
							payload[key] = null;
						} else {
							payload[key] = compPayload;
						}
					} else {
						payload[key] = null;
					}
				} else {
					payload[key] = null;
				}
				break;
			}

			case 'dynamiczone': {
				if (Array.isArray(value) && value.length > 0) {
					payload[key] = value
						.filter((item) => item && item.__component)
						.map((item) => {
							const compUid = item.__component;
							const compDef = attr.schemas?.[compUid];
							if (compDef) {
								const { payload: compPayload } = buildStrapiPayload(
									item,
									compDef,
									adapter,
									options
								);
								return {
									__component: compUid,
									...compPayload
								};
							}
							return item;
						});
				} else {
					payload[key] = [];
				}
				break;
			}

			default:
				payload[key] = value !== undefined ? value : null;
		}
	}

	return { payload, warnings };
}

/**
 * Post-import verification: retrieves and inspects the saved Strapi entry.
 * Verifies that:
 * 1. Document-provided fields contain the mapped values.
 * 2. Document-missing optional fields are actually empty in Strapi.
 * 3. Existing Strapi values were not unintentionally preserved.
 *
 * @param {object} params
 * @param {any} params.resultEntry Normalized result entry from Strapi adapter
 * @param {any} params.schema Target content type schema
 * @param {any} params.sourceData Document source data mapped
 * @param {boolean} [params.isUpdating=false]
 * @param {any} [params.existingEntry=null] Prior entry if update occurred
 * @returns {{ verified: boolean, discrepancies: string[], checksCount: number }}
 */
export function verifyImportedEntry({
	resultEntry,
	schema,
	sourceData,
	isUpdating = false,
	existingEntry = null
}) {
	const discrepancies = [];
	let checksCount = 0;
	const attributes = schema?.attributes || {};
	const savedAttrs = resultEntry?.attributes || {};
	const oldAttrs = existingEntry?.attributes || {};

	for (const [key, attr] of Object.entries(attributes)) {
		if (attr.manualOnly) continue;

		checksCount += 1;
		const docVal = sourceData?.[key];
		const isDocMissing =
			docVal === undefined ||
			docVal === null ||
			docVal === '' ||
			(Array.isArray(docVal) && docVal.length === 0);

		const savedVal = savedAttrs[key];
		const isSavedEmpty =
			savedVal === undefined ||
			savedVal === null ||
			savedVal === '' ||
			(Array.isArray(savedVal) && savedVal.length === 0);

		if (isDocMissing) {
			if (!attr.required) {
				// Missing optional field must be empty in Strapi
				if (!isSavedEmpty) {
					// Check if Strapi preserved an old value during update
					if (isUpdating && oldAttrs[key]) {
						discrepancies.push(
							`Field "${key}" was missing in document but retained existing Strapi value.`
						);
					}
				}
			}
		} else {
			// Field was in document: verify it was not cleared or lost
			if (isSavedEmpty && !attr.manualOnly) {
				discrepancies.push(
					`Field "${key}" was present in document but is empty in saved Strapi entry.`
				);
			}
		}
	}

	return {
		verified: discrepancies.length === 0,
		discrepancies,
		checksCount
	};
}
