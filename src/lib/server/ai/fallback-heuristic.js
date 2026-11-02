import { extractIntermediateDocument } from '../document/intermediate.js';
import { mapDocumentToSchema } from '../mapping/semantic-mapper.js';

/**
 * Deterministic heuristic extraction engine.
 * Used when AI is offline, in mock mode, or as fallback.
 * Uses the two-stage pipeline:
 * Stage 1: Document Intermediate Content Extraction
 * Stage 2: Schema-Aware Semantic Mapping
 *
 * @param {object} params
 * @param {import('../document/model.js').DocumentModel} params.documentModel
 * @param {any} params.contentTypeDef
 * @returns {{ data: any, fieldNotes: any[], warnings: string[], unmapped: any[], issues?: any[] }}
 */
export function extractHeuristics({ documentModel, contentTypeDef }) {
	const intermediateDoc = extractIntermediateDocument(documentModel);
	return mapDocumentToSchema({
		intermediateDoc,
		documentModel,
		contentTypeDef
	});
}
