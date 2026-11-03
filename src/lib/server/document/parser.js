import mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import { applyHeuristics, detectUnsupportedWordFeatures } from './heuristics.js';
import { blocksToMarkdown } from './to-markdown.js';

const DEFAULT_STYLE_MAP = [
	"p[style-name='Title'] => h1:fresh",
	"p[style-name='Subtitle'] => p.subtitle:fresh",
	"p[style-name='Heading 1'] => h1:fresh",
	"p[style-name='Heading 2'] => h2:fresh",
	"p[style-name='Heading 3'] => h3:fresh",
	"p[style-name='Heading 4'] => h4:fresh",
	"p[style-name='Heading 5'] => h5:fresh",
	"p[style-name='Heading 6'] => h6:fresh",
	"p[style-name='Quote'] => blockquote:fresh",
	"p[style-name='Intense Quote'] => blockquote:fresh"
];

/**
 * Parses a DOCX buffer into a rich, normalized DocumentModel.
 *
 * @param {Buffer} docxBuffer
 * @param {object} [options]
 * @param {string[]} [options.customStyleMap]
 * @returns {Promise<import('./model.js').DocumentModel>}
 */
export async function parseDocx(docxBuffer, options = {}) {
	/** @type {import('./model.js').DocumentImage[]} */
	const images = [];
	let imageCounter = 0;

	// Image converter callback for Mammoth
	const convertImage = mammoth.images.imgElement((image) => {
		imageCounter += 1;
		const id = `img-${imageCounter}`;
		const mime = image.contentType || 'image/png';
		const alt = /** @type {any} */ (image).altText || '';

		return image.read().then((buffer) => {
			images.push({
				id,
				mime,
				bytes: buffer.length,
				alt,
				order: imageCounter,
				buffer
			});
			return {
				src: `docimg://${id}`,
				alt
			};
		});
	});

	const styleMap = [...DEFAULT_STYLE_MAP, ...(options.customStyleMap || [])];

	// Run mammoth conversion
	const mammothResult = await mammoth.convertToHtml(
		{ buffer: docxBuffer },
		{
			styleMap,
			convertImage
		}
	);

	/** @type {string[]} */
	const warnings = mammothResult.messages.map((m) => m.message);

	// Detect unsupported Word features (textboxes, tracked changes, etc.)
	const featureWarnings = await detectUnsupportedWordFeatures(docxBuffer);
	warnings.push(...featureWarnings);

	// Load HTML into cheerio
	const $ = cheerio.load(mammothResult.value || '', null, false);

	/**
	 * Converts a Cheerio table element into clean, valid HTML table markup:
	 * <table>
	 *   <thead><tr><th>...</th></tr></thead>
	 *   <tbody><tr><td>...</td></tr></tbody>
	 * </table>
	 * Preserves all columns, rows, cell formatting, and original order.
	 *
	 * @param {any} $table Cheerio table element
	 * @param {any} $cheerio Cheerio instance
	 * @returns {string} Clean HTML table string
	 */
	function formatHtmlTable($table, $cheerio) {
		const $directTrs =
			$table.children('tr').length > 0
				? $table.children('tr')
				: $table.children('thead, tbody, tfoot').children('tr');

		if ($directTrs.length === 0) return '';

		/** @type {{ isTh: boolean, html: string, text: string }[][]} */
		const rows = [];
		let hasTh = false;

		$directTrs.each((_, tr) => {
			const $tr = $cheerio(tr);
			/** @type {{ isTh: boolean, html: string, text: string }[]} */
			const cells = [];
			$tr.children('th, td').each((_, cell) => {
				const $cell = $cheerio(cell);
				const isTh = cell.tagName?.toLowerCase() === 'th';
				if (isTh) hasTh = true;

				// Handle embedded images inside cell
				const imgEl = $cell.find('img[src^="docimg://"]');
				if (imgEl.length > 0) {
					const src = imgEl.attr('src') || '';
					const imgId = src.replace('docimg://', '');
					if (!$cell.text().trim()) {
						$cell.text(imgId);
					}
				}

				let innerHtml = $cell.html()?.trim() || '';
				if (/^<p>(.*?)<\/p>$/s.test(innerHtml)) {
					innerHtml = innerHtml.replace(/^<p>(.*?)<\/p>$/s, '$1');
				}
				const cellText = $cell.text().trim();

				cells.push({
					isTh,
					html: innerHtml || cellText,
					text: cellText
				});
			});

			if (cells.length > 0) {
				rows.push(cells);
			}
		});

		if (rows.length === 0) return '';

		const firstRowIsHeader =
			rows.length > 1 &&
			(hasTh ||
				rows[0].some(
					(c) => c.isTh || c.html.includes('<strong>') || c.html.includes('<b>')
				) ||
				true);

		let out = '<table>\n';
		let bodyStartIdx = 0;

		if (firstRowIsHeader) {
			out += '  <thead>\n    <tr>\n';
			rows[0].forEach((c) => {
				let headerText = c.html.replace(/<\/?strong>/gi, '').replace(/<\/?b>/gi, '').trim();
				if (!headerText) headerText = c.text;
				out += `      <th>${headerText}</th>\n`;
			});
			out += '    </tr>\n  </thead>\n';
			bodyStartIdx = 1;
		}

		out += '  <tbody>\n';
		for (let i = bodyStartIdx; i < rows.length; i++) {
			out += '    <tr>\n';
			rows[i].forEach((c) => {
				out += `      <td>${c.html || c.text}</td>\n`;
			});
			out += '    </tr>\n';
		}
		out += '  </tbody>\n</table>';

		return out;
	}

	// Pre-process any nested tables inside table cells into clean HTML table markup
	$('table table').each((_, nestedTbl) => {
		const $nested = $(nestedTbl);
		const cleanTableHtml = formatHtmlTable($nested, $);
		$nested.replaceWith(cleanTableHtml);
	});

	/** @type {import('./model.js').Block[]} */
	const rawBlocks = [];
	let blockCounter = 0;

	/**
	 * Generates a stable block ID.
	 * @returns {string}
	 */
	function nextBlockId() {
		blockCounter += 1;
		return `b${blockCounter}`;
	}

	/**
	 * Extracts list items recursively, handling nested lists.
	 * @param {any} listEl
	 * @param {number} level
	 * @returns {{ text: string, html: string, level: number }[]}
	 */
	function extractListItems(listEl, level = 0) {
		/** @type {{ text: string, html: string, level: number }[]} */
		const items = [];
		$(listEl)
			.children('li')
			.each((_, li) => {
				const $li = $(li);
				// Clone to remove nested ul/ol when reading text for this item
				const $clone = $li.clone();
				$clone.children('ul, ol').remove();

				const text = $clone.text().trim();
				const html = $clone.html()?.trim() || text;

				if (text || html) {
					items.push({ text, html, level });
				}

				// Check nested lists
				$li.children('ul, ol').each((_, nested) => {
					items.push(...extractListItems(nested, level + 1));
				});
			});
		return items;
	}

	// Traverse top-level body nodes
	// If elements are wrapped in standard container or direct children
	const rootElements = $('body').length > 0 ? $('body').children() : $.root().children();

	rootElements.each((_, el) => {
		const $el = $(el);
		const tagName = el.tagName?.toLowerCase();

		// Check for embedded images inside paragraph or container
		const embeddedImgs = $el.find('img[src^="docimg://"]');
		if (embeddedImgs.length > 0 && tagName === 'p' && $el.text().trim() === '') {
			// Paragraph with ONLY image(s)
			embeddedImgs.each((_, imgEl) => {
				const src = $(imgEl).attr('src') || '';
				const imageId = src.replace('docimg://', '');
				const alt = $(imgEl).attr('alt') || '';
				rawBlocks.push({
					id: nextBlockId(),
					type: 'image',
					text: alt ? `[Image: ${alt}]` : `[Image: ${imageId}]`,
					html: `<img src="docimg://${imageId}" alt="${alt}">`,
					imageId,
					alt,
					sectionPath: []
				});
			});
			return;
		}

		if (/^h[1-6]$/.test(tagName)) {
			const level = parseInt(tagName.replace('h', ''), 10);
			const text = $el.text().trim();
			const html = $el.html()?.trim() || text;
			if (text) {
				rawBlocks.push({
					id: nextBlockId(),
					type: 'heading',
					level,
					text,
					html,
					sectionPath: []
				});
			}
			return;
		}

		if (tagName === 'blockquote') {
			const text = $el.text().trim();
			const html = $el.html()?.trim() || text;
			if (text) {
				rawBlocks.push({
					id: nextBlockId(),
					type: 'quote',
					text,
					html,
					sectionPath: []
				});
			}
			return;
		}

		if (tagName === 'ul' || tagName === 'ol') {
			const ordered = tagName === 'ol';
			const items = extractListItems(el, 0);
			if (items.length > 0) {
				const text = items.map((i) => i.text).join('\n');
				rawBlocks.push({
					id: nextBlockId(),
					type: 'list',
					ordered,
					items,
					text,
					html: $el.html()?.trim() || '',
					sectionPath: []
				});
			}
			return;
		}

		if (tagName === 'table') {
			/** @type {string[][]} */
			const rows = [];
			/** @type {string[][]} */
			const rowHtmls = [];
			let hasTh = false;

			const $directTrs =
				$el.children('tr').length > 0
					? $el.children('tr')
					: $el.children('thead, tbody, tfoot').children('tr');

			$directTrs.each((_, tr) => {
				/** @type {string[]} */
				const row = [];
				/** @type {string[]} */
				const rHtml = [];

				$(tr)
					.children('th, td')
					.each((_, cell) => {
						if (cell.tagName.toLowerCase() === 'th') hasTh = true;
						const $cell = $(cell);
						let cellText = $cell.text().trim();
						const imgEl = $cell.find('img[src^="docimg://"]');
						if (imgEl.length > 0) {
							const src = imgEl.attr('src') || '';
							const imgId = src.replace('docimg://', '');
							if (!cellText) {
								cellText = imgId;
							} else if (!cellText.includes(imgId)) {
								cellText = `${cellText} [${imgId}]`;
							}
						}
						row.push(cellText);
						rHtml.push($cell.html()?.trim() || cellText);
					});
				if (row.length > 0) {
					rows.push(row);
					rowHtmls.push(rHtml);
				}
			});

			if (rows.length > 0) {
				const text = rows.map((r) => r.join(' | ')).join('\n');
				const cleanHtml = formatHtmlTable($el, $);
				rawBlocks.push({
					id: nextBlockId(),
					type: 'table',
					rows,
					rowHtmls,
					headerRow: hasTh || rows.length > 1,
					text,
					html: cleanHtml || $el.html()?.trim() || '',
					sectionPath: []
				});
			}
			return;
		}

		// Fallback for paragraph or unknown div
		// Check if images are mixed with text
		if (embeddedImgs.length > 0) {
			embeddedImgs.each((_, imgEl) => {
				const src = $(imgEl).attr('src') || '';
				const imageId = src.replace('docimg://', '');
				const alt = $(imgEl).attr('alt') || '';
				rawBlocks.push({
					id: nextBlockId(),
					type: 'image',
					text: alt ? `[Image: ${alt}]` : `[Image: ${imageId}]`,
					html: `<img src="docimg://${imageId}" alt="${alt}">`,
					imageId,
					alt,
					sectionPath: []
				});
			});
		}

		const cloneForText = $el.clone();
		cloneForText.find('img').remove();
		const text = cloneForText.text().trim();
		const html = cloneForText.html()?.trim() || text;

		if (text) {
			rawBlocks.push({
				id: nextBlockId(),
				type: 'paragraph',
				text,
				html,
				sectionPath: []
			});
		}
	});

	// Apply heuristics for fake headings, section paths, and hints
	const { blocks, hints, sections } = applyHeuristics(rawBlocks);

	// Associate nearest headings with images
	let lastHeading = '';
	for (const block of blocks) {
		if (block.type === 'heading') {
			lastHeading = block.text;
		} else if (block.type === 'image' && block.imageId) {
			const foundImg = images.find((img) => img.id === block.imageId);
			if (foundImg) {
				foundImg.nearestHeading = lastHeading;
			}
		}
	}

	const markdown = blocksToMarkdown(blocks);
	const plainText = blocks.map((b) => b.text).join('\n\n');

	return {
		blocks,
		sections,
		images,
		plainText,
		markdown,
		warnings,
		hints
	};
}
