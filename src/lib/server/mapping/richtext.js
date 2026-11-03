import * as cheerio from 'cheerio';

/**
 * Converts sanitized HTML into standard Markdown for Strapi richtext attributes.
 *
 * @param {string} html
 * @returns {string} Markdown string
 */
export function htmlToMarkdown(html) {
	if (!html || typeof html !== 'string') return '';
	if (!html.includes('<')) return html.trim();

	const $ = cheerio.load(html, null, false);

	// Convert links
	$('a').each((_, el) => {
		const href = $(el).attr('href') || '';
		const text = $(el).text();
		$(el).replaceWith(`[${text}](${href})`);
	});

	// Convert bold
	$('strong, b').each((_, el) => {
		$(el).replaceWith(`**${$(el).text()}**`);
	});

	// Convert italic
	$('em, i').each((_, el) => {
		$(el).replaceWith(`*${$(el).text()}*`);
	});

	// Convert inline code
	$('code').each((_, el) => {
		$(el).replaceWith(`\`${$(el).text()}\``);
	});

	// Convert blockquotes
	$('blockquote').each((_, el) => {
		$(el).replaceWith(`\n> ${$(el).text().trim()}\n`);
	});

	// Convert headings
	for (let i = 1; i <= 6; i++) {
		$(`h${i}`).each((_, el) => {
			const hashes = '#'.repeat(i);
			$(el).replaceWith(`\n${hashes} ${$(el).text().trim()}\n`);
		});
	}

	// Convert list items
	$('li').each((_, el) => {
		const isOrdered = $(el).parent().is('ol');
		const index = $(el).index() + 1;
		const prefix = isOrdered ? `${index}. ` : '- ';
		$(el).replaceWith(`\n${prefix}${$(el).text().trim()}`);
	});

	$('ul, ol').each((_, el) => {
		$(el).replaceWith(`\n${$(el).text().trim()}\n`);
	});

	// Convert tables to markdown tables
	$('table').each((_, el) => {
		const $tbl = $(el);
		/** @type {string[][]} */
		const rows = [];
		$tbl.find('tr').each((_, tr) => {
			/** @type {string[]} */
			const row = [];
			$(tr)
				.find('th, td')
				.each((_, cell) => {
					row.push($(cell).text().trim().replace(/\|/g, '\\|'));
				});
			if (row.length > 0) rows.push(row);
		});

		if (rows.length > 0) {
			let mdTable = '\n\n';
			rows.forEach((row, rIdx) => {
				mdTable += `| ${row.join(' | ')} |\n`;
				if (rIdx === 0) {
					mdTable += `| ${row.map(() => '---').join(' | ')} |\n`;
				}
			});
			mdTable += '\n';
			$tbl.replaceWith(mdTable);
		}
	});

	$('p').each((_, el) => {
		$(el).replaceWith(`\n\n${$(el).text().trim()}\n\n`);
	});

	$('br').replaceWith('\n');

	return $.root()
		.text()
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}
