import { htmlToStrapiBlocks } from './blocks.js';
import { htmlToMarkdown } from './richtext.js';
import { generateSlug } from './slug.js';

/**
 * Recursively maps and whitelists reviewed form data into a Strapi-ready payload.
 *
 * @param {any} rawData The user-reviewed content data
 * @param {any} contentTypeDef Normalized schema definition
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

		// Handle missing / empty values
		if (value === undefined || value === null || value === '') {
			if (attr.required && !options.isUpdate) {
				warnings.push(`Required field "${key}" is empty.`);
			}
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
				payload[key] = str;
				break;
			}

			case 'text': {
				payload[key] = String(value).trim();
				break;
			}

			case 'uid': {
				let slug = String(value).trim();
				if (!slug && attr.targetField && rawData[attr.targetField]) {
					slug = generateSlug(rawData[attr.targetField]);
				}
				payload[key] = slug || 'entry';
				break;
			}

			case 'blocks': {
				payload[key] = htmlToStrapiBlocks(value);
				break;
			}

			case 'richtext': {
				payload[key] = typeof value === 'string' ? htmlToMarkdown(value) : value;
				break;
			}

			case 'number': {
				const num = Number(value);
				if (!isNaN(num)) {
					payload[key] = num;
				}
				break;
			}

			case 'boolean': {
				payload[key] = Boolean(value);
				break;
			}

			case 'json': {
				if (typeof value === 'object' && value !== null) {
					payload[key] = value;
				} else if (typeof value === 'string' && value.trim()) {
					try {
						payload[key] = JSON.parse(value);
					} catch {
						payload[key] = value;
					}
				}
				break;
			}

			case 'date': {
				payload[key] = String(value).trim();
				break;
			}

			case 'enumeration': {
				payload[key] = String(value);
				break;
			}

			case 'media': {
				// Can be an uploaded numeric id, documentId string, or { $docImage: "img-1" }
				if (typeof value === 'object' && value?.$docImage) {
					payload[key] = value;
				} else if (typeof value === 'number' || (typeof value === 'string' && value.trim())) {
					payload[key] = value;
				}
				break;
			}

			case 'relation': {
				// Formats relation with adapter (e.g. { connect: [...] })
				if (value) {
					payload[key] = adapter.formatRelation(value);
				}
				break;
			}

			case 'component': {
				if (attr.repeatable) {
					if (Array.isArray(value)) {
						payload[key] = value.map((item) => {
							const { payload: compPayload } = buildStrapiPayload(
								item,
								attr.schema,
								adapter,
								options
							);
							// Strip out client-side id on create
							delete compPayload.id;
							return compPayload;
						});
					}
				} else if (typeof value === 'object') {
					const { payload: compPayload } = buildStrapiPayload(value, attr.schema, adapter, options);
					delete compPayload.id;
					payload[key] = compPayload;
				}
				break;
			}

			case 'dynamiczone': {
				if (Array.isArray(value)) {
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
				}
				break;
			}

			default:
				payload[key] = value;
		}
	}

	return { payload, warnings };
}
