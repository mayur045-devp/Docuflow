import { z } from 'zod';

/**
 * Creates a Zod schema for an attribute definition.
 * @param {any} attr
 * @returns {z.ZodTypeAny}
 */
export function attributeToZod(attr) {
	if (!attr) return z.any();

	let schema;

	switch (attr.type) {
		case 'string':
		case 'text':
		case 'email':
		case 'richtext':
		case 'blocks': {
			let str = z.string();
			if (attr.type === 'email') str = str.email();
			if (attr.minLength) str = str.min(attr.minLength);
			if (attr.maxLength) str = str.max(attr.maxLength);
			if (attr.regex) {
				try {
					str = str.regex(new RegExp(attr.regex));
				} catch {
					// Ignore invalid regex
				}
			}
			schema = str;
			break;
		}

		case 'uid': {
			let str = z.string();
			if (attr.maxLength) str = str.max(attr.maxLength);
			schema = str;
			break;
		}

		case 'number': {
			let num = z.coerce.number();
			if (attr.min !== undefined) num = num.min(attr.min);
			if (attr.max !== undefined) num = num.max(attr.max);
			schema = num;
			break;
		}

		case 'boolean': {
			schema = z.coerce.boolean();
			break;
		}

		case 'json': {
			schema = z.union([
				z.record(z.string(), z.any()),
				z.array(z.any()),
				z.string(),
				z.null(),
				z.undefined()
			]);
			break;
		}

		case 'date': {
			schema = z.string();
			break;
		}

		case 'enumeration': {
			schema = z.string();
			break;
		}

		case 'media': {
			// Can be string imageId, number uploaded id, array of imageIds/numbers, object, or null
			const mediaItem = z.union([
				z.string(),
				z.number(),
				z.record(z.string(), z.any())
			]);
			schema = z.union([
				mediaItem,
				z.array(mediaItem),
				z.null(),
				z.undefined()
			]);
			break;
		}

		case 'relation': {
			// Can be string lookup text, number id, documentId string, null, or array of these for multi-relations
			const relationItem = z.union([
				z.string(),
				z.number(),
				z.record(z.string(), z.any())
			]);
			schema = z.union([
				relationItem,
				z.array(relationItem),
				z.array(z.any()),
				z.null(),
				z.undefined()
			]);
			break;
		}

		case 'component': {
			if (!attr.schema) {
				schema = z.any();
			} else {
				const compZod = contentTypeToZod(attr.schema);
				if (attr.repeatable) {
					let arr = z.array(compZod);
					if (attr.min) {
						if (!attr.required) {
							// For optional repeatable components, an empty array (0 items) represents
							// an intentionally absent component and is valid.
							let populatedArr = z.array(compZod).min(attr.min);
							if (attr.max) populatedArr = populatedArr.max(attr.max);
							schema = z.union([z.array(compZod).length(0), populatedArr]);
						} else {
							arr = arr.min(attr.min);
							if (attr.max) arr = arr.max(attr.max);
							schema = arr;
						}
					} else {
						if (attr.max) arr = arr.max(attr.max);
						schema = arr;
					}
				} else {
					schema = compZod;
				}
			}
			break;
		}

		case 'dynamiczone': {
			// Array of objects, each having __component
			const allowed = attr.components || [];
			const baseObj = z
				.object({
					__component: z.enum(allowed.length > 0 ? allowed : ['unknown'])
				})
				.passthrough();

			let dzArray = z.array(baseObj);
			if (attr.min) dzArray = dzArray.min(attr.min);
			if (attr.max) dzArray = dzArray.max(attr.max);
			schema = dzArray;
			break;
		}

		default:
			schema = z.any();
	}

	if (!attr.required) {
		schema = schema.optional().nullable().or(z.literal(''));
	}

	return schema;
}

/**
 * Creates a Zod object schema for a full normalized ContentTypeDef.
 * @param {any} contentTypeDef
 * @returns {z.ZodObject<any>}
 */
export function contentTypeToZod(contentTypeDef) {
	const shape = {};

	if (contentTypeDef && contentTypeDef.attributes) {
		for (const [key, attr] of Object.entries(contentTypeDef.attributes)) {
			if (!attr.manualOnly) {
				shape[key] = attributeToZod(attr);
			}
		}
	}

	return z.object(shape).passthrough();
}

/**
 * Validates data against a ContentTypeDef and returns detailed field-level issues.
 * @param {any} contentTypeDef
 * @param {any} data
 * @returns {{ valid: boolean, data: any, issues: { path: string, message: string, severity: 'error' | 'warning' }[] }}
 */
export function validateContentData(contentTypeDef, data) {
	const schema = contentTypeToZod(contentTypeDef);
	const result = schema.safeParse(data);

	if (result.success) {
		return { valid: true, data: result.data, issues: [] };
	}

	const issues = result.error.issues.map((iss) => ({
		path: iss.path.join('.'),
		message: iss.message,
		severity: /** @type {'error'} */ ('error')
	}));

	return {
		valid: false,
		data,
		issues
	};
}
