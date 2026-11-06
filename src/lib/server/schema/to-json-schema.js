/**
 * Converts a normalized attribute definition into a Gemini-compatible JSON schema node.
 * Uses only the standard OpenAPI / Gemini supported keywords.
 *
 * @param {any} attr
 * @returns {any}
 */
export function attributeToJsonSchema(attr) {
	if (!attr || attr.manualOnly) {
		return null;
	}

	const description = attr.description || `Field "${attr.name}" (${attr.type})`;

	switch (attr.type) {
		case 'string':
		case 'email':
		case 'text':
		case 'richtext':
		case 'blocks':
			return {
				type: 'STRING',
				description:
					attr.type === 'richtext' || attr.type === 'blocks'
						? `${description}. Return clean HTML formatted text (p, h2-h4, ul, ol, li, strong, em, br).`
						: description
			};

		case 'uid':
			return {
				type: 'STRING',
				description: `${description}. May be left empty if auto-generated from title/name.`
			};

		case 'number':
			return {
				type: 'NUMBER',
				description
			};

		case 'boolean':
			return {
				type: 'BOOLEAN',
				description
			};

		case 'json':
			return {
				type: 'OBJECT',
				description: `${description}. Valid JSON object.`
			};

		case 'date':
			return {
				type: 'STRING',
				description: `${description}. ISO date or date-time string (YYYY-MM-DD).`
			};

		case 'enumeration':
			return {
				type: 'STRING',
				enum: attr.enum && attr.enum.length > 0 ? attr.enum : ['default'],
				description
			};

		case 'media':
			if (attr.multiple) {
				return {
					type: 'ARRAY',
					description: `${description}. Return array of imageId strings extracted from the document (e.g. ["img-1", "img-2"]), or empty array if no relevant images.`,
					items: { type: 'STRING' }
				};
			}
			return {
				type: 'STRING',
				description: `${description}. Return the exact imageId extracted from the document (e.g. "img-1"), or empty string if no relevant image.`
			};

		case 'relation':
			return {
				type: 'STRING',
				description: `${description}. Return the human-readable lookup text (e.g. target name or category title), never numeric IDs.`
			};

		case 'component': {
			if (!attr.schema) {
				return { type: 'OBJECT', description: `${description} (unresolved component)` };
			}

			const compSchema = contentTypeToJsonSchema(attr.schema, false);
			if (attr.repeatable) {
				return {
					type: 'ARRAY',
					description: `${description}. Repeatable items list.`,
					items: compSchema
				};
			}
			return {
				...compSchema,
				description
			};
		}

		case 'dynamiczone': {
			// Dynamic zone items with __component discriminator
			const allowed = attr.components || [];
			const combinedProperties = {
				__component: {
					type: 'STRING',
					enum: allowed.length > 0 ? allowed : ['default.component'],
					description: 'The Strapi component UID'
				}
			};

			// Merge properties from all allowed components into the dynamic block
			for (const compUid of allowed) {
				const compDef = attr.schemas?.[compUid];
				if (compDef && compDef.attributes) {
					for (const [k, a] of Object.entries(compDef.attributes)) {
						if (!combinedProperties[k]) {
							const propNode = attributeToJsonSchema(a);
							if (propNode) {
								combinedProperties[k] = propNode;
							}
						}
					}
				}
			}

			return {
				type: 'ARRAY',
				description: `${description}. List of dynamic zone component blocks.`,
				items: {
					type: 'OBJECT',
					properties: combinedProperties,
					required: ['__component']
				}
			};
		}

		default:
			return {
				type: 'STRING',
				description
			};
	}
}

/**
 * Converts a normalized ContentTypeDef into a JSON Schema for Gemini structured output.
 *
 * @param {any} contentTypeDef
 * @param {boolean} [wrapEnvelope=true] If true, wraps in { data, fieldNotes, warnings, unmapped }
 * @returns {any}
 */
export function contentTypeToJsonSchema(contentTypeDef, wrapEnvelope = true) {
	const properties = {};
	const required = [];

	if (contentTypeDef && contentTypeDef.attributes) {
		for (const [key, attr] of Object.entries(contentTypeDef.attributes)) {
			const propSchema = attributeToJsonSchema(attr);
			if (propSchema) {
				properties[key] = propSchema;
				if (attr.required) {
					required.push(key);
				}
			}
		}
	}

	const dataSchema = {
		type: 'OBJECT',
		properties,
		...(required.length > 0 ? { required } : {})
	};

	if (!wrapEnvelope) {
		return dataSchema;
	}

	// Full envelope matching Section 6.5
	return {
		type: 'OBJECT',
		properties: {
			data: dataSchema,
			fieldNotes: {
				type: 'ARRAY',
				description: 'Evaluation notes for every schema field, indicating whether it was found or missing in the document',
				items: {
					type: 'OBJECT',
					properties: {
						field: { type: 'STRING', description: 'Field name or path like "title" or "author"' },
						path: { type: 'STRING', description: 'Field path alias' },
						status: { type: 'STRING', enum: ['found', 'missing'], description: '"found" if present in document, "missing" if absent' },
						value: { type: 'STRING', description: 'Optional value preview or "null"' },
						confidence: { type: 'NUMBER', description: 'Confidence between 0.0 and 1.0 (0.0 for missing)' },
						sourceBlockIds: {
							type: 'ARRAY',
							items: { type: 'STRING' },
							description: 'Source block IDs from document like ["b1", "b2"], or empty array'
						},
						note: { type: 'STRING', description: 'Optional explanation or status note' }
					},
					required: ['field', 'status']
				}
			},
			warnings: {
				type: 'ARRAY',
				items: { type: 'STRING' },
				description: 'Any missing fields or mapping ambiguities'
			},
			unmapped: {
				type: 'ARRAY',
				description: 'Sections or blocks that could not be mapped to any schema field',
				items: {
					type: 'OBJECT',
					properties: {
						blockIds: { type: 'ARRAY', items: { type: 'STRING' } },
						reason: { type: 'STRING' }
					},
					required: ['blockIds', 'reason']
				}
			}
		},
		required: ['data']
	};
}
