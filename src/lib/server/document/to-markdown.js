/**
 * Renders blocks into compact markdown with embedded [bID] tags for LLM source tracking.
 * @param {import('./model.js').Block[]} blocks
 * @returns {string}
 */
export function blocksToMarkdown(blocks) {
	const lines = [];

	for (const block of blocks) {
		const tag = `[${block.id}]`;

		switch (block.type) {
			case 'heading': {
				const hashes = '#'.repeat(Math.min(6, Math.max(1, block.level || 2)));
				lines.push(`\n${hashes} ${block.text} ${tag}`);
				break;
			}

			case 'paragraph': {
				lines.push(`${tag} ${block.text}`);
				break;
			}

			case 'quote': {
				lines.push(`> ${tag} ${block.text}`);
				break;
			}

			case 'list': {
				if (block.items && block.items.length > 0) {
					lines.push(`${tag}`);
					block.items.forEach((item, idx) => {
						const indent = '  '.repeat(item.level || 0);
						const bullet = block.ordered ? `${idx + 1}.` : '-';
						lines.push(`${indent}${bullet} ${item.text}`);
					});
				}
				break;
			}

			case 'table': {
				if (block.rows && block.rows.length > 0) {
					lines.push(`\n${tag} [Table]`);
					block.rows.forEach((row, rowIdx) => {
						const rowStr = `| ${row.map((c) => c.replace(/\|/g, '\\|').trim()).join(' | ')} |`;
						lines.push(rowStr);
						if (rowIdx === 0 && block.headerRow !== false) {
							const sep = `| ${row.map(() => '---').join(' | ')} |`;
							lines.push(sep);
						}
					});
				}
				break;
			}

			case 'image': {
				const alt = block.alt ? ` "${block.alt}"` : '';
				lines.push(`${tag} ![Image: ${block.imageId}${alt}](docimg://${block.imageId})`);
				break;
			}

			default:
				if (block.text) {
					lines.push(`${tag} ${block.text}`);
				}
		}
	}

	return lines.join('\n').trim();
}
