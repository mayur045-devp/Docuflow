const SYSTEM_FIELDS = new Set([
	'id',
	'documentId',
	'createdAt',
	'updatedAt',
	'publishedAt',
	'createdBy',
	'updatedBy',
	'locale',
	'localizations'
]);

/**
 * Normalizes an attribute definition from Strapi schema.
 *
 * @param {string} attrName
 * @param {any} rawAttr
 * @param {Record<string, any>} componentRegistry Map of "category.name" -> raw component json
 * @param {Set<string>} visited Stack of component names to prevent circular infinite recursion
 * @param {number} depth Recursion depth
 * @returns {any|null} Normalized attribute or null if system/unmappable
 */
export function normalizeAttribute(
	attrName,
	rawAttr,
	componentRegistry = {},
	visited = new Set(),
	depth = 0
) {
	if (!rawAttr || SYSTEM_FIELDS.has(attrName)) {
		return null;
	}

	if (rawAttr.private === true || rawAttr.type === 'password') {
		return null;
	}

	const base = {
		name: attrName,
		type: rawAttr.type,
		required: Boolean(rawAttr.required),
		unique: Boolean(rawAttr.unique),
		default: rawAttr.default !== undefined ? rawAttr.default : null,
		manualOnly: false
	};

	if (rawAttr.minLength !== undefined) base.minLength = rawAttr.minLength;
	if (rawAttr.maxLength !== undefined) base.maxLength = rawAttr.maxLength;
	if (rawAttr.min !== undefined) base.min = rawAttr.min;
	if (rawAttr.max !== undefined) base.max = rawAttr.max;
	if (rawAttr.regex !== undefined) base.regex = rawAttr.regex;

	switch (rawAttr.type) {
		case 'string':
		case 'text':
		case 'richtext':
		case 'blocks':
		case 'email':
			return { ...base, type: rawAttr.type };

		case 'integer':
		case 'biginteger':
		case 'float':
		case 'decimal':
		case 'number':
			return { ...base, type: 'number', numberType: rawAttr.type };

		case 'boolean':
			return { ...base, type: 'boolean' };

		case 'json':
			return { ...base, type: 'json' };

		case 'date':
		case 'datetime':
		case 'time':
		case 'timestamp':
			return { ...base, type: 'date', dateType: rawAttr.type };

		case 'enumeration':
			return {
				...base,
				type: 'enumeration',
				enum: Array.isArray(rawAttr.enum) ? rawAttr.enum : []
			};

		case 'uid':
			return {
				...base,
				type: 'uid',
				targetField: rawAttr.targetField || null
			};

		case 'media':
			return {
				...base,
				type: 'media',
				multiple: Boolean(rawAttr.multiple),
				allowedTypes: Array.isArray(rawAttr.allowedTypes)
					? rawAttr.allowedTypes
					: ['images', 'files', 'videos']
			};

		case 'relation':
			return {
				...base,
				type: 'relation',
				relation: rawAttr.relation || 'oneToOne',
				target: rawAttr.target || '',
				displayField: rawAttr.displayField || 'name'
			};

		case 'component': {
			const compUid = rawAttr.component;
			if (!compUid) return null;

			if (depth >= 6 || visited.has(compUid)) {
				// Cycle detected or depth limit exceeded
				return {
					...base,
					type: 'component',
					componentUid: compUid,
					repeatable: Boolean(rawAttr.repeatable),
					schema: null,
					manualOnly: true,
					note: 'Component nesting depth limit or circular reference reached'
				};
			}

			const rawComp = componentRegistry[compUid];
			const newVisited = new Set(visited).add(compUid);
			const compSchema = rawComp
				? normalizeContentType(rawComp, componentRegistry, newVisited, depth + 1)
				: null;

			return {
				...base,
				type: 'component',
				componentUid: compUid,
				repeatable: Boolean(rawAttr.repeatable),
				schema: compSchema
			};
		}

		case 'dynamiczone': {
			const allowedComponents = Array.isArray(rawAttr.components) ? rawAttr.components : [];
			const schemas = {};

			for (const compUid of allowedComponents) {
				const rawComp = componentRegistry[compUid];
				if (rawComp && depth < 6 && !visited.has(compUid)) {
					const newVisited = new Set(visited).add(compUid);
					schemas[compUid] = normalizeContentType(
						rawComp,
						componentRegistry,
						newVisited,
						depth + 1
					);
				}
			}

			return {
				...base,
				type: 'dynamiczone',
				components: allowedComponents,
				schemas
			};
		}

		default:
			// Custom field or unsupported type marked as manualOnly
			return {
				...base,
				manualOnly: true
			};
	}
}

/**
 * Normalizes a full Strapi content type or component JSON.
 *
 * @param {any} raw
 * @param {Record<string, any>} [componentRegistry={}]
 * @param {Set<string>} [visited=new Set()]
 * @param {number} [depth=0]
 * @returns {any}
 */
export function normalizeContentType(raw, componentRegistry = {}, visited = new Set(), depth = 0) {
	if (!raw) return null;

	const info = raw.info || {};
	const options = raw.options || {};
	const attributes = raw.attributes || {};

	const normalizedAttributes = {};
	for (const [key, val] of Object.entries(attributes)) {
		const normalized = normalizeAttribute(key, val, componentRegistry, visited, depth);
		if (normalized) {
			normalizedAttributes[key] = normalized;
		}
	}

	return {
		uid:
			raw.uid ||
			(info.singularName ? `api::${info.singularName}.${info.singularName}` : raw.collectionName),
		collectionName: raw.collectionName || '',
		kind: raw.kind || 'collectionType',
		displayName: info.displayName || info.singularName || 'Untitled',
		singularName: info.singularName || '',
		pluralName: info.pluralName || `${info.singularName || 'item'}s`,
		description: info.description || '',
		draftAndPublish: Boolean(options.draftAndPublish),
		attributes: normalizedAttributes
	};
}
