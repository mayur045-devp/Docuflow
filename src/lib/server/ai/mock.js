import { extractIntermediateDocument } from '../document/intermediate.js';
import { mapDocumentToSchema } from '../mapping/semantic-mapper.js';

/**
 * Mock AI Provider for offline testing, demos, and CI.
 * Implements full Stage 1 (Intermediate Content Extraction) and Stage 2 (Semantic Mapping).
 * @type {import('./provider.js').AIProvider & { setDocumentContext: (doc: any, schema: any) => void }}
 */
export const mockProvider = {
	_currentDoc: null,
	_currentSchema: null,

	setDocumentContext(documentModel, contentTypeDef) {
		this._currentDoc = documentModel;
		this._currentSchema = contentTypeDef;
	},

	async generateStructured({ prompt: _prompt, jsonSchema: _jsonSchema }) {
		if (this._currentDoc && this._currentSchema) {
			const intermediateDoc = extractIntermediateDocument(this._currentDoc);
			const result = mapDocumentToSchema({
				intermediateDoc,
				documentModel: this._currentDoc,
				contentTypeDef: this._currentSchema
			});

			return {
				text: JSON.stringify(result),
				data: result,
				tokensUsed: 150
			};
		}

		// Fallback empty structured response
		const emptyResult = {
			data: {},
			fieldNotes: [],
			warnings: ['Mock AI extraction executed without document context'],
			unmapped: [],
			issues: []
		};

		return {
			text: JSON.stringify(emptyResult),
			data: emptyResult,
			tokensUsed: 50
		};
	}
};
