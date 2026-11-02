/**
 * @typedef {{
 *   _currentDoc?: any,
 *   _currentSchema?: any,
 *   setDocumentContext?: (doc: any, schema: any) => void,
 *   generateStructured(params: {
 *     prompt?: string,
 *     jsonSchema?: any,
 *     signal?: AbortSignal,
 *     model?: string
 *   }): Promise<{ text: string, data: any, tokensUsed?: number }>
 * }} AIProvider
 */

export {};
