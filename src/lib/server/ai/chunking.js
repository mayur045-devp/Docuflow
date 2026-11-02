/**
 * Merges partial extraction results from multiple document sections.
 *
 * @param {any[]} partialResults
 * @returns {{ data: any, fieldNotes: any[], warnings: string[], unmapped: any[] }}
 */
export function mergePartialExtractions(partialResults) {
	if (!partialResults || partialResults.length === 0) {
		return { data: {}, fieldNotes: [], warnings: [], unmapped: [] };
	}

	if (partialResults.length === 1) {
		return partialResults[0];
	}

	const mergedData = {};
	const mergedNotes = [];
	const mergedWarnings = [];
	const mergedUnmapped = [];

	for (const part of partialResults) {
		const partData = part.data || {};

		for (const [key, val] of Object.entries(partData)) {
			if (val === undefined || val === null || val === '') continue;

			if (Array.isArray(val)) {
				// Concatenate arrays (repeatable components or dynamic zones)
				if (!Array.isArray(mergedData[key])) {
					mergedData[key] = [];
				}
				mergedData[key].push(...val);
			} else if (typeof val === 'object' && val !== null) {
				// Single component: merge properties
				mergedData[key] = {
					...(mergedData[key] || {}),
					...val
				};
			} else {
				// Scalar: first-non-empty, warn if conflict
				if (mergedData[key] === undefined || mergedData[key] === '') {
					mergedData[key] = val;
				} else if (mergedData[key] !== val) {
					mergedWarnings.push(
						`Multiple values extracted for "${key}": keeping "${mergedData[key]}" and ignoring later "${val}".`
					);
				}
			}
		}

		if (Array.isArray(part.fieldNotes)) mergedNotes.push(...part.fieldNotes);
		if (Array.isArray(part.warnings)) mergedWarnings.push(...part.warnings);
		if (Array.isArray(part.unmapped)) mergedUnmapped.push(...part.unmapped);
	}

	return {
		data: mergedData,
		fieldNotes: mergedNotes,
		warnings: mergedWarnings,
		unmapped: mergedUnmapped
	};
}
