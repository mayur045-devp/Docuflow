import * as cheerio from 'cheerio';

/**
 * Converts inline HTML nodes into Strapi Blocks inline children.
 *
 * @param {any} el
 * @param {any} $
 * @param {object} formatting
 * @returns {any[]}
 */
function parseInlineNodes(el, $, formatting = {}) {
	const children = [];

	$(el)
		.contents()
		.each((_, node) => {
			if (node.type === 'text') {
				const text = node.data;
				if (text) {
					children.push({
						type: 'text',
						text,
						...formatting
					});
				}
				return;
			}

			if (node.type === 'tag') {
				const tag = node.tagName.toLowerCase();

				if (tag === 'strong' || tag === 'b') {
					children.push(...parseInlineNodes(node, $, { ...formatting, bold: true }));
					return;
				}

				if (tag === 'em' || tag === 'i') {
					children.push(...parseInlineNodes(node, $, { ...formatting, italic: true }));
					return;
				}

				if (tag === 'u') {
					children.push(...parseInlineNodes(node, $, { ...formatting, underline: true }));
					return;
				}

				if (tag === 's' || tag === 'del' || tag === 'strike') {
					children.push(...parseInlineNodes(node, $, { ...formatting, strikethrough: true }));
					return;
				}

				if (tag === 'code') {
					children.push(...parseInlineNodes(node, $, { ...formatting, code: true }));
					return;
				}

				if (tag === 'br') {
					children.push({ type: 'text', text: '\n', ...formatting });
					return;
				}

				if (tag === 'a') {
					const url = $(node).attr('href') || '#';
					const linkChildren = parseInlineNodes(node, $, formatting);
					children.push({
						type: 'link',
						url,
						children: linkChildren.length > 0 ? linkChildren : [{ type: 'text', text: url }]
					});
					return;
				}

				// Generic container/span
				children.push(...parseInlineNodes(node, $, formatting));
			}
		});

	return children;
}

/**
 * Converts an HTML string into Strapi Blocks JSON format.
 *
 * @param {string|any} html
 * @returns {any[]} Array of Strapi Block nodes
 */
export function htmlToStrapiBlocks(html) {
	if (!html || typeof html !== 'string') {
		if (Array.isArray(html)) return html; // already blocks
		return [{ type: 'paragraph', children: [{ type: 'text', text: '' }] }];
	}

	const trimmed = html.trim();
	if (!trimmed) {
		return [{ type: 'paragraph', children: [{ type: 'text', text: '' }] }];
	}

	// If plain text with no tags, wrap in single paragraph
	if (!trimmed.includes('<')) {
		const paragraphs = trimmed.split(/\n\s*\n/);
		return paragraphs.map((p) => ({
			type: 'paragraph',
			children: [{ type: 'text', text: p.trim() }]
		}));
	}

	const $ = cheerio.load(trimmed, null, false);
	const blocks = [];

	const rootEls = $('body').length > 0 ? $('body').children() : $.root().children();

	// If root has text nodes without wrapper tags
	if (rootEls.length === 0 && trimmed) {
		const inlineChildren = parseInlineNodes($.root(), $);
		return [
			{
				type: 'paragraph',
				children: inlineChildren.length > 0 ? inlineChildren : [{ type: 'text', text: trimmed }]
			}
		];
	}

	rootEls.each((_, el) => {
		const tag = el.tagName?.toLowerCase();

		if (/^h[1-6]$/.test(tag)) {
			const level = parseInt(tag.replace('h', ''), 10);
			const children = parseInlineNodes(el, $);
			blocks.push({
				type: 'heading',
				level,
				children: children.length > 0 ? children : [{ type: 'text', text: $(el).text() }]
			});
			return;
		}

		if (tag === 'blockquote') {
			const children = parseInlineNodes(el, $);
			blocks.push({
				type: 'quote',
				children: children.length > 0 ? children : [{ type: 'text', text: $(el).text() }]
			});
			return;
		}

		if (tag === 'pre') {
			const codeText = $(el).text();
			blocks.push({
				type: 'code',
				children: [{ type: 'text', text: codeText }]
			});
			return;
		}

		if (tag === 'ul' || tag === 'ol') {
			const format = tag === 'ol' ? 'ordered' : 'unordered';
			const listItems = [];

			$(el)
				.children('li')
				.each((__, li) => {
					const liChildren = parseInlineNodes(li, $);
					listItems.push({
						type: 'list-item',
						children: liChildren.length > 0 ? liChildren : [{ type: 'text', text: $(li).text() }]
					});
				});

			if (listItems.length > 0) {
				blocks.push({
					type: 'list',
					format,
					children: listItems
				});
			}
			return;
		}

		if (tag === 'table') {
			const $table = $(el);
			const $trs = $table.find('tr');
			/** @type {string[]} */
			let headers = [];

			$trs.each((rIdx, tr) => {
				const $cells = $(tr).find('th, td');
				if (rIdx === 0 && ($(tr).find('th').length > 0 || $trs.length > 1)) {
					headers = $cells.map((_, c) => $(c).text().trim()).get();
					const headerText = headers.join(' | ');
					blocks.push({
						type: 'paragraph',
						children: [{ type: 'text', text: headerText, bold: true }]
					});
				} else {
					const rowChildren = [];
					$cells.each((cIdx, cell) => {
						const label = headers[cIdx] ? `${headers[cIdx]}: ` : '';
						const val = $(cell).text().trim();
						if (label) {
							rowChildren.push({ type: 'text', text: label, bold: true });
						}
						rowChildren.push({
							type: 'text',
							text: cIdx < $cells.length - 1 ? `${val} | ` : val
						});
					});
					if (rowChildren.length > 0) {
						blocks.push({
							type: 'paragraph',
							children: rowChildren
						});
					}
				}
			});
			return;
		}

		// Paragraph or generic block container
		const children = parseInlineNodes(el, $);
		if (children.length > 0) {
			blocks.push({
				type: 'paragraph',
				children
			});
		}
	});

	if (blocks.length === 0) {
		blocks.push({
			type: 'paragraph',
			children: [{ type: 'text', text: $($.root()).text() || '' }]
		});
	}

	return blocks;
}
