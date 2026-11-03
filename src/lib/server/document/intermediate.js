/**
 * Normalizes a key string for fuzzy comparison:
 * lowercase, removes whitespace, underscores, hyphens, and non-alphanumeric chars.
 * @param {string} str
 * @returns {string}
 */
export function normalizeKey(str) {
	if (!str) return '';
	return str
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '')
		.trim();
}

/**
 * Extracts a rich intermediate representation from a parsed DocumentModel.
 * Preserves document hierarchy, section groupings, table key-value pairs,
 * repeatable rows, bullet lists, and embedded image associations.
 *
 * @param {import('./model.js').DocumentModel} docModel
 * @returns {{
 *   sections: any[],
 *   keyValues: any[],
 *   repeatedGroups: any[],
 *   images: any[],
 *   fullMarkdown: string
 * }}
 */
export function extractIntermediateDocument(docModel) {
	const blocks = docModel.blocks || [];
	const images = docModel.images || [];
	const hints = docModel.hints || [];

	const sections = [];
	let currentSection = {
		heading: '',
		level: 0,
		blockIds: [],
		keyValues: [],
		repeatedRecords: [],
		tables: [],
		paragraphs: [],
		lists: [],
		images: []
	};

	function flushSection() {
		if (
			currentSection.blockIds.length > 0 ||
			currentSection.heading ||
			currentSection.paragraphs.length > 0 ||
			currentSection.keyValues.length > 0
		) {
			// Post-process currentSection:
			// 1. Detect bullet list items formatted as Title: Description
			for (const listBlock of currentSection.lists) {
				const listItems = listBlock.items || [];
				const listRecs = [];
				for (const item of listItems) {
					const text = item.text?.trim() || '';
					const parts = text.split(/[:–-]\s+/);
					if (parts.length >= 2) {
						listRecs.push({
							blockIds: [listBlock.blockId],
							fields: {
								title: parts[0].trim(),
								description: parts.slice(1).join(': ').trim()
							},
							rawFields: {
								title: parts[0].trim(),
								description: parts.slice(1).join(': ').trim()
							}
						});
					}
				}
				if (listRecs.length >= 1) {
					currentSection.repeatedRecords.push({
						sectionHeading: currentSection.heading,
						blockId: listBlock.blockId,
						records: listRecs
					});
				}
			}

			// 2. Detect service/feature items from keyValues or paragraphs in service-like sections
			const normHeading = normalizeKey(currentSection.heading);
			const isServiceHeading =
				normHeading.includes('service') ||
				normHeading.includes('expertise') ||
				normHeading.includes('offering') ||
				normHeading.includes('feature') ||
				normHeading.includes('product');

			if (isServiceHeading && currentSection.keyValues.length >= 1) {
				const sRecs = currentSection.keyValues.map((kv) => ({
					blockIds: kv.blockId ? [kv.blockId] : [],
					fields: {
						title: kv.rawKey,
						description: kv.value
					},
					rawFields: {
						title: kv.rawKey,
						description: kv.value
					}
				}));
				currentSection.repeatedRecords.push({
					sectionHeading: currentSection.heading,
					blockId: currentSection.keyValues[0].blockId,
					records: sRecs
				});
			}

			const paraRecs = [];
			for (const p of currentSection.paragraphs) {
				const text = p.text?.trim() || '';
				if (text.includes(':') && !text.toLowerCase().startsWith('q:') && !text.toLowerCase().startsWith('a:')) {
					const parts = text.split(/:\s+/);
					if (parts.length >= 2 && parts[0].length < 60) {
						paraRecs.push({
							blockIds: [p.blockId],
							fields: {
								title: parts[0].trim(),
								description: parts.slice(1).join(': ').trim()
							},
							rawFields: {
								title: parts[0].trim(),
								description: parts.slice(1).join(': ').trim()
							}
						});
					}
				}
			}
			if (paraRecs.length >= 2) {
				currentSection.repeatedRecords.push({
					sectionHeading: currentSection.heading,
					blockId: paraRecs[0].blockIds[0],
					records: paraRecs
				});
			}

			// 3. Detect FAQ Q&A pattern from headings and paragraphs
			const faqRecs = [];
			for (let i = 0; i < currentSection.paragraphs.length; i++) {
				const p = currentSection.paragraphs[i];
				const text = p.text?.trim() || '';
				if (/^q:\s*/i.test(text) && i + 1 < currentSection.paragraphs.length) {
					const nextP = currentSection.paragraphs[i + 1];
					const nextText = nextP.text?.trim() || '';
					if (/^a:\s*/i.test(nextText)) {
						faqRecs.push({
							blockIds: [p.blockId, nextP.blockId],
							fields: {
								question: text.replace(/^q:\s*/i, '').trim(),
								answer: nextText.replace(/^a:\s*/i, '').trim()
							},
							rawFields: {
								question: text.replace(/^q:\s*/i, '').trim(),
								answer: nextText.replace(/^a:\s*/i, '').trim()
							}
						});
						i += 1;
					}
				}
			}

			// Also check question headings followed by paragraphs
			const isFaqHeading =
				normHeading.includes('faq') ||
				normHeading.includes('question') ||
				normHeading.includes('inquir');

			if (isFaqHeading && faqRecs.length === 0) {
				for (let i = 0; i < currentSection.paragraphs.length; i++) {
					const p = currentSection.paragraphs[i];
					const text = p.text?.trim() || '';
					if (text.endsWith('?') && i + 1 < currentSection.paragraphs.length) {
						const nextP = currentSection.paragraphs[i + 1];
						faqRecs.push({
							blockIds: [p.blockId, nextP.blockId],
							fields: {
								question: text,
								answer: nextP.text?.trim() || ''
							},
							rawFields: {
								question: text,
								answer: nextP.text?.trim() || ''
							}
						});
						i += 1;
					}
				}
			}

			if (faqRecs.length >= 1) {
				currentSection.repeatedRecords.push({
					sectionHeading: currentSection.heading,
					isFaq: true,
					blockId: faqRecs[0].blockIds[0],
					records: faqRecs
				});
			}

			// 4. Detect repeated records from multiple tables within the same section
			if (currentSection.tables.length >= 2) {
				const twoColTables = currentSection.tables.filter(
					(t) => t.rows && t.rows.length >= 1 && t.rows.every((r) => r.length === 2)
				);

				if (twoColTables.length >= 2) {
					const tableRecords = twoColTables.map((t) => {
						const fields = {};
						const rawFields = {};
						const keys = [];
						for (let i = 0; i < t.rows.length; i++) {
							const [kStr, vStr] = t.rows[i];
							const normK = normalizeKey(kStr);
							const rawK = kStr?.trim();
							const vHtml = t.rowHtmls?.[i]?.[1];
							const bestVal = vHtml && vHtml.includes('<') ? vHtml : (vStr?.trim() ?? '');
							if (normK) {
								fields[normK] = bestVal;
								rawFields[rawK] = bestVal;
								keys.push(normK);
							}
						}
						return {
							blockId: t.blockId,
							keys,
							fields,
							rawFields
						};
					});

					// Check key overlap across tables
					const commonKeys = tableRecords[0].keys.filter((k) =>
						tableRecords.slice(1).every((tr) => tr.keys.includes(k))
					);

					if (commonKeys.length >= 1 || tableRecords.length >= 2) {
						const records = tableRecords.map((tr) => ({
							blockIds: [tr.blockId],
							fields: tr.fields,
							rawFields: tr.rawFields
						}));

						currentSection.repeatedRecords.push({
							sectionHeading: currentSection.heading,
							blockId: tableRecords[0].blockId,
							records
						});

						const claimedBlockIds = new Set(tableRecords.map((tr) => tr.blockId));
						currentSection.keyValues = currentSection.keyValues.filter(
							(kv) => !claimedBlockIds.has(kv.blockId)
						);
					}
				}
			}

			sections.push(currentSection);
		}
	}

	function startNewSection(heading, level, blockId) {
		flushSection();
		currentSection = {
			heading,
			level,
			blockIds: blockId ? [blockId] : [],
			keyValues: [],
			repeatedRecords: [],
			tables: [],
			paragraphs: [],
			lists: [],
			images: []
		};
	}

	for (let bi = 0; bi < blocks.length; bi++) {
		const block = blocks[bi];
		currentSection.blockIds.push(block.id);

		if (block.type === 'heading') {
			const text = block.text.trim();
			// If level 1 or 2, start new section
			// If level >= 3 and next block is paragraph in a FAQ section, treat as FAQ Q&A item
			const normCurHeading = normalizeKey(currentSection.heading);
			const isFaqSection =
				normCurHeading.includes('faq') ||
				normCurHeading.includes('question') ||
				normCurHeading.includes('inquir');

			if (isFaqSection && bi + 1 < blocks.length && blocks[bi + 1].type === 'paragraph') {
				const nextBlock = blocks[bi + 1];
				let existingFaqGroup = currentSection.repeatedRecords.find((rg) => rg.isFaq);
				if (!existingFaqGroup) {
					existingFaqGroup = {
						sectionHeading: currentSection.heading,
						isFaq: true,
						blockId: block.id,
						records: []
					};
					currentSection.repeatedRecords.push(existingFaqGroup);
				}
				existingFaqGroup.records.push({
					blockIds: [block.id, nextBlock.id],
					fields: {
						question: text,
						answer: nextBlock.text?.trim() || ''
					},
					rawFields: {
						question: text,
						answer: nextBlock.text?.trim() || ''
					}
				});
				bi += 1;
				continue;
			}

			startNewSection(text, block.level || 2, block.id);
			continue;
		}

		if (block.type === 'image') {
			if (block.imageId) {
				currentSection.images.push(block.imageId);
			}
			continue;
		}

		if (block.type === 'paragraph') {
			const text = block.text?.trim() || '';
			if (!text) continue;

			// Check if paragraph is formatted as "Key: Value" or "Key | Value"
			const kvMatch = text.match(/^([A-Za-z0-9\s_-]{2,40})[:|]\s*(.+)$/s);
			if (kvMatch && !text.includes('\n')) {
				const rawKey = kvMatch[1].trim();
				const rawVal = kvMatch[2].trim();
				currentSection.keyValues.push({
					key: normalizeKey(rawKey),
					rawKey,
					value: rawVal,
					blockId: block.id,
					sectionHeading: currentSection.heading
				});
			} else {
				currentSection.paragraphs.push({
					text,
					html: block.html || `<p>${text}</p>`,
					blockId: block.id
				});
			}
			continue;
		}

		if (block.type === 'list') {
			currentSection.lists.push({
				ordered: block.ordered,
				items: block.items || [],
				blockId: block.id
			});
			continue;
		}

		if (block.type === 'table') {
			const rows = block.rows || [];
			if (rows.length === 0) continue;

			currentSection.tables.push({
				blockId: block.id,
				rows,
				headerRow: block.headerRow,
				rowHtmls: block.rowHtmls
			});

			// Case 1: 2-column table
			const isTwoColumn = rows.every((r) => r.length === 2);
			if (isTwoColumn) {
				const seenKeys = new Set();
				let hasDuplicates = false;
				for (const r of rows) {
					const k = normalizeKey(r[0]);
					if (k) {
						if (seenKeys.has(k)) {
							hasDuplicates = true;
							break;
						}
						seenKeys.add(k);
					}
				}

				if (hasDuplicates) {
					const records = [];
					let currentRecord = null;
					let primaryKey = null;

					for (let i = 0; i < rows.length; i++) {
						const [kStr, vStr] = rows[i];
						const vHtml = block.rowHtmls?.[i]?.[1];
						const normK = normalizeKey(kStr);
						if (!normK) continue;

						if (!primaryKey) {
							primaryKey = normK;
						}

						if (normK === primaryKey && currentRecord && Object.keys(currentRecord.fields).length > 0) {
							records.push(currentRecord);
							currentRecord = null;
						}

						if (!currentRecord) {
							currentRecord = {
								blockIds: [block.id],
								fields: {},
								rawFields: {}
							};
						}

						// Prefer rich HTML for value if it contains HTML tags (e.g. <table>, <p>, <ul>)
						const bestVal = vHtml && vHtml.includes('<') ? vHtml : vStr.trim();
						currentRecord.fields[normK] = bestVal;
						currentRecord.rawFields[kStr.trim()] = bestVal;
					}

					if (currentRecord && Object.keys(currentRecord.fields).length > 0) {
						records.push(currentRecord);
					}

					if (records.length > 0) {
						currentSection.repeatedRecords.push({
							sectionHeading: currentSection.heading,
							blockId: block.id,
							records
						});
					}
				} else {
					for (let i = 0; i < rows.length; i++) {
						const [kStr, vStr] = rows[i];
						const vHtml = block.rowHtmls?.[i]?.[1];
						const rawKey = kStr?.trim();
						const bestVal =
							vHtml && vHtml.includes('<') ? vHtml : (vStr?.trim() ?? '');
						if (rawKey) {
							currentSection.keyValues.push({
								key: normalizeKey(rawKey),
								rawKey,
								value: bestVal,
								blockId: block.id,
								sectionHeading: currentSection.heading
							});
						}
					}
				}
				continue;
			}

			// Case 2: Multi-column table
			// Only treat as repeatedRecords if headers correspond to service/offering/feature definitions
			// or if headers clearly represent repeated component records (e.g. Service | Description).
			// Otherwise, it is a content table that belongs inside this section's content flow.
			const normHeaders = rows.length >= 2 ? rows[0].map(normalizeKey) : [];
			const isServiceOrFaqTable = normHeaders.some((h) =>
				['service', 'offering', 'feature', 'capability', 'question', 'faq'].includes(h)
			);
			const normSectionHeading = normalizeKey(currentSection.heading);
			const isRepeatableSection =
				normSectionHeading.includes('service') ||
				normSectionHeading.includes('offering') ||
				normSectionHeading.includes('faq');

			if (
				rows.length >= 2 &&
				(isServiceOrFaqTable ||
					(isRepeatableSection && !normSectionHeading.includes('content')))
			) {
				const headers = rows[0].map((h) => h.trim());
				const records = [];

				for (let r = 1; r < rows.length; r++) {
					const row = rows[r];
					const rec = {
						blockIds: [block.id],
						fields: {},
						rawFields: {}
					};
					for (let c = 0; c < headers.length; c++) {
						const headerKey = normHeaders[c] || `col${c}`;
						const val = row[c]?.trim() ?? '';
						rec.fields[headerKey] = val;
						rec.rawFields[headers[c] || `col${c}`] = val;
					}
					records.push(rec);
				}

				if (records.length > 0) {
					currentSection.repeatedRecords.push({
						sectionHeading: currentSection.heading,
						blockId: block.id,
						headers,
						records
					});
				}
			} else {
				// Content table within section: preserve as clean HTML markup
				currentSection.paragraphs.push({
					text: block.text,
					html: block.html || `<p>${block.text}</p>`,
					blockId: block.id
				});
			}
		}
	}

	flushSection();

	// Flatten all key-values across sections
	const allKeyValues = [];
	for (const sec of sections) {
		for (const kv of sec.keyValues) {
			allKeyValues.push(kv);
		}
	}

	// Flatten all repeated groups across sections
	const allRepeatedGroups = [];
	for (const sec of sections) {
		for (const rg of sec.repeatedRecords) {
			allRepeatedGroups.push(rg);
		}
	}

	// Also check parser hints for Q&A patterns
	const qaItems = [];
	const qaBlockIds = [];
	for (const hint of hints) {
		if (hint.type === 'qa_pattern' && hint.data?.question && hint.data?.answer) {
			qaItems.push({
				blockIds: hint.blockIds || [],
				fields: {
					question: hint.data.question.trim(),
					answer: hint.data.answer.trim()
				},
				rawFields: {
					question: hint.data.question.trim(),
					answer: hint.data.answer.trim()
				}
			});
			qaBlockIds.push(...(hint.blockIds || []));
		}
	}

	if (qaItems.length > 0) {
		allRepeatedGroups.push({
			sectionHeading: 'Frequently Asked Questions',
			blockId: qaBlockIds[0] || 'qa',
			isFaq: true,
			records: qaItems
		});
	}

	return {
		sections,
		keyValues: allKeyValues,
		repeatedGroups: allRepeatedGroups,
		images,
		fullMarkdown: docModel.markdown || ''
	};
}
