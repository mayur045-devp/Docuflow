/**
 * @typedef {{
 *   id: string,
 *   type: 'heading' | 'paragraph' | 'list' | 'table' | 'image' | 'quote',
 *   level?: number,
 *   text: string,
 *   html: string,
 *   items?: { text: string, html: string, level: number }[],
 *   ordered?: boolean,
 *   rows?: string[][],
 *   headerRow?: boolean,
 *   imageId?: string,
 *   alt?: string,
 *   inferredHeading?: boolean,
 *   sectionPath: string[]
 * }} Block
 */

/**
 * @typedef {{
 *   id: string,
 *   mime: string,
 *   bytes: number,
 *   alt?: string,
 *   order: number,
 *   nearestHeading?: string,
 *   buffer?: Buffer
 * }} DocumentImage
 */

/**
 * @typedef {{
 *   title: string,
 *   level: number,
 *   blockIds: string[],
 *   children: SectionNode[]
 * }} SectionNode
 */

/**
 * @typedef {{
 *   type: 'qa_pattern' | 'key_value_table' | 'heading_paragraph_pair' | 'promoted_heading',
 *   description: string,
 *   blockIds: string[],
 *   data?: any
 * }} DocumentHint
 */

/**
 * @typedef {{
 *   blocks: Block[],
 *   sections: SectionNode[],
 *   images: DocumentImage[],
 *   plainText: string,
 *   markdown: string,
 *   warnings: string[],
 *   hints: DocumentHint[]
 * }} DocumentModel
 */

export const EMPTY_DOCUMENT_MODEL = {
	blocks: [],
	sections: [],
	images: [],
	plainText: '',
	markdown: '',
	warnings: [],
	hints: []
};
