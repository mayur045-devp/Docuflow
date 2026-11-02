import JSZip from 'jszip';

/**
 * Inspects a DOCX zip archive for features Mammoth typically cannot convert.
 * @param {Buffer} docxBuffer
 * @returns {Promise<string[]>} List of warnings
 */
export async function detectUnsupportedWordFeatures(docxBuffer) {
	/** @type {string[]} */
	const warnings = [];
	try {
		const zip = await JSZip.loadAsync(docxBuffer);
		const files = Object.keys(zip.files);

		// Check for headers and footers
		const hasHeaderFooter = files.some((f) => /word\/(header|footer)\d+\.xml/i.test(f));
		if (hasHeaderFooter) {
			warnings.push(
				'Document contains headers or footers. Note: Word headers and footers are not included in the main content flow.'
			);
		}

		// Check for comments
		if (files.some((f) => /word\/comments/i.test(f))) {
			warnings.push('Document contains Word comments, which are excluded from content extraction.');
		}

		// Inspect main document XML
		const docXmlFile = zip.file('word/document.xml');
		if (docXmlFile) {
			const xml = await docXmlFile.async('string');

			if (xml.includes('w:txbxContent')) {
				warnings.push(
					'Document contains floating text boxes. Some text box content may be ignored or out of order.'
				);
			}
			if (xml.includes('w:ins') || xml.includes('w:del')) {
				warnings.push(
					'Document contains tracked changes (revisions). Only the current accepted text view is processed.'
				);
			}
			if (xml.includes('m:oMath') || xml.includes('m:oMathPara')) {
				warnings.push(
					'Document contains mathematical equations (OMath) which may not convert to plain text.'
				);
			}
			if (xml.includes('smartArt') || xml.includes('diagrams')) {
				warnings.push('Document contains SmartArt diagrams which cannot be converted to text.');
			}
		}
	} catch {
		// Non-fatal warning detection error
	}
	return warnings;
}

/**
 * Checks if a paragraph should be promoted to a heading.
 * @param {import('./model.js').Block} block
 * @returns {boolean}
 */
export function isPromotableHeading(block) {
	if (block.type !== 'paragraph') return false;
	const text = block.text.trim();
	if (!text || text.length > 80) return false;

	// Ignore if it ends with sentence punctuation (. ? !)
	if (/[.?!]$/.test(text)) return false;

	// 1. Entirely bold: html is <strong>text</strong> or <p><strong>text</strong></p>
	const cleanHtml = block.html.replace(/<\/?p>/g, '').trim();
	if (/^<(strong|b)>.*?<\/(strong|b)>$/i.test(cleanHtml)) {
		return true;
	}

	// 2. ALL CAPS with letters and at least 3 chars
	const letters = text.replace(/[^a-zA-Z]/g, '');
	if (letters.length >= 3 && letters === letters.toUpperCase()) {
		return true;
	}

	return false;
}

/**
 * Analyzes blocks to promote fake headings, build section paths, and find hints.
 * @param {import('./model.js').Block[]} blocks
 * @returns {{ blocks: import('./model.js').Block[], hints: import('./model.js').DocumentHint[], sections: import('./model.js').SectionNode[] }}
 */
export function applyHeuristics(blocks) {
	/** @type {import('./model.js').DocumentHint[]} */
	const hints = [];

	// First pass: promote headings
	const processedBlocks = blocks.map((b, idx) => {
		if (isPromotableHeading(b)) {
			// If it's the very first block, treat it as Level 1 (Title), otherwise Level 2
			const level = idx === 0 ? 1 : 2;
			hints.push({
				type: 'promoted_heading',
				description: `Inferred heading "${b.text}" from formatted paragraph`,
				blockIds: [b.id],
				data: { originalType: 'paragraph', promotedLevel: level }
			});
			return {
				...b,
				type: /** @type {'heading'} */ ('heading'),
				level,
				inferredHeading: true
			};
		}
		return b;
	});

	// Second pass: track section hierarchy & paths
	/** @type {string[]} */
	const currentPath = [];
	/** @type {import('./model.js').SectionNode[]} */
	const sections = [];
	/** @type {Map<number, import('./model.js').SectionNode>} */
	const stack = new Map();

	for (const block of processedBlocks) {
		if (block.type === 'heading') {
			const level = block.level || 2;
			// Trim current path to level - 1
			while (currentPath.length >= level) {
				currentPath.pop();
			}
			currentPath.push(block.text);
			block.sectionPath = [...currentPath];

			/** @type {import('./model.js').SectionNode} */
			const sectionNode = {
				title: block.text,
				level,
				blockIds: [block.id],
				children: []
			};

			stack.set(level, sectionNode);

			if (level === 1 || !stack.has(level - 1)) {
				sections.push(sectionNode);
			} else {
				const parent = stack.get(level - 1);
				if (parent) {
					parent.children.push(sectionNode);
				} else {
					sections.push(sectionNode);
				}
			}
		} else {
			block.sectionPath = [...currentPath];
			// Add to current deepest section blockIds
			if (currentPath.length > 0) {
				const currentSection = stack.get(currentPath.length);
				if (currentSection) {
					currentSection.blockIds.push(block.id);
				}
			}
		}
	}

	// Third pass: pattern detection (Q&A, Key-Value tables, Heading-Paragraph pairs)
	for (let i = 0; i < processedBlocks.length; i++) {
		const b = processedBlocks[i];

		// Key-Value table
		if (b.type === 'table' && b.rows && b.rows.length >= 2) {
			const isTwoCol = b.rows.every((r) => r.length === 2);
			if (isTwoCol) {
				hints.push({
					type: 'key_value_table',
					description: `Two-column key-value table detected at block ${b.id}`,
					blockIds: [b.id],
					data: { rowCount: b.rows.length }
				});
			}
		}

		// Q&A patterns in consecutive blocks or within block
		if (b.type === 'paragraph' || b.type === 'heading') {
			const text = b.text.trim();
			// Matches "Q: Question" or "Question: ..."
			if (/^(Q|Question)[:.-]\s+/i.test(text) && i + 1 < processedBlocks.length) {
				const next = processedBlocks[i + 1];
				if (/^(A|Answer)[:.-]\s+/i.test(next.text.trim())) {
					hints.push({
						type: 'qa_pattern',
						description: `Q&A pair detected between blocks ${b.id} and ${next.id}`,
						blockIds: [b.id, next.id],
						data: {
							question: text.replace(/^(Q|Question)[:.-]\s+/i, ''),
							answer: next.text.replace(/^(A|Answer)[:.-]\s+/i, '')
						}
					});
				}
			} else if (text.includes('\nA:') || text.includes('\nAnswer:')) {
				hints.push({
					type: 'qa_pattern',
					description: `Single-block Q&A pattern detected in ${b.id}`,
					blockIds: [b.id]
				});
			}
		}

		// Heading -> Paragraph pair
		if (b.type === 'heading' && i + 1 < processedBlocks.length) {
			const next = processedBlocks[i + 1];
			if (next.type === 'paragraph') {
				hints.push({
					type: 'heading_paragraph_pair',
					description: `Heading/Content pair "${b.text}"`,
					blockIds: [b.id, next.id],
					data: { heading: b.text }
				});
			}
		}
	}

	return { blocks: processedBlocks, hints, sections };
}
