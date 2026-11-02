<script>
	/**
	 * @typedef {Object} Props
	 * @property {any} schema Normalized content type definition
	 * @property {any} data Form data
	 * @property {any[]} [fieldNotes=[]] Field notes
	 * @property {any[]} [unmapped=[]] Unmapped document sections
	 * @property {any[]} [issues=[]] Validation issues
	 * @property {(path: string) => void} [onSelectField] Focus callback
	 */

	/** @type {Props} */
	let {
		schema,
		data = {},
		fieldNotes = [],
		unmapped = [],
		issues = [],
		onSelectField
	} = $props();

	let collapsed = $state(false);

	/**
	 * Helper to get a human-readable preview of any value
	 * @param {any} val
	 * @returns {string}
	 */
	function formatPreview(val) {
		if (val === undefined || val === null || val === '') return '—';
		if (typeof val === 'string') {
			const clean = val.replace(/<[^>]+>/g, '').trim();
			return clean.length > 50 ? clean.slice(0, 50) + '...' : clean || '—';
		}
		if (typeof val === 'number' || typeof val === 'boolean') {
			return String(val);
		}
		if (Array.isArray(val)) {
			return `${val.length} item(s)`;
		}
		if (typeof val === 'object') {
			return JSON.stringify(val).slice(0, 50) + '...';
		}
		return String(val);
	}

	// Compute list of rows recursively across top-level fields and components
	let rows = $derived.by(() => {
		const result = [];
		const attributes = schema?.attributes || {};
		const issuePaths = new Set((issues || []).map((i) => i.path));

		function processAttributes(attrs, currentData, prefix = '', indent = 0) {
			for (const [key, attr] of Object.entries(attrs || {})) {
				if (attr.manualOnly) continue;

				const fieldPath = prefix ? `${prefix}.${key}` : key;
				const val = currentData?.[key];
				const fieldNote = fieldNotes.find((fn) => fn.path === fieldPath);
				const hasIssue = issuePaths.has(fieldPath);

				if (attr.type === 'component') {
					if (attr.repeatable) {
						const items = Array.isArray(val) ? val : [];
						const isFound = items.length > 0;
						let status = 'Missing in Document';
						let statusClass = 'bg-slate-800 text-slate-400 border-slate-700';

						if (hasIssue) {
							status = 'Invalid Value';
							statusClass = 'bg-rose-950 text-rose-300 border-rose-800 font-semibold';
						} else if (isFound) {
							status = 'Successfully Mapped';
							statusClass = 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
						} else if (attr.required) {
							status = 'Needs Manual Review';
							statusClass = 'bg-amber-950 text-amber-300 border-amber-800 font-semibold';
						}

						result.push({
							field: fieldPath,
							type: 'repeatable component',
							required: Boolean(attr.required),
							extractedContent: fieldNote?.note || (isFound ? `${items.length} items extracted` : 'None'),
							mappedValue: `${items.length} item(s)`,
							status,
							statusClass,
							indent,
							isHeader: true
						});

						// Expand component subitems
						items.forEach((item, idx) => {
							processAttributes(
								attr.schema?.attributes || {},
								item,
								`${fieldPath}[${idx}]`,
								indent + 1
							);
						});
					} else {
						// Single component
						const compVal = typeof val === 'object' && val !== null ? val : null;
						const isFound = Boolean(compVal && Object.values(compVal).some((v) => v !== '' && v !== null));
						let status = 'Missing in Document';
						let statusClass = 'bg-slate-800 text-slate-400 border-slate-700';

						if (hasIssue) {
							status = 'Invalid Value';
							statusClass = 'bg-rose-950 text-rose-300 border-rose-800 font-semibold';
						} else if (isFound) {
							status = 'Successfully Mapped';
							statusClass = 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
						} else if (attr.required) {
							status = 'Needs Manual Review';
							statusClass = 'bg-amber-950 text-amber-300 border-amber-800 font-semibold';
						}

						result.push({
							field: fieldPath,
							type: 'single component',
							required: Boolean(attr.required),
							extractedContent: fieldNote?.note || (isFound ? 'Component content found' : 'None'),
							mappedValue: isFound ? 'Object populated' : 'Empty',
							status,
							statusClass,
							indent,
							isHeader: true
						});

						// Expand single component fields
						processAttributes(attr.schema?.attributes || {}, compVal || {}, fieldPath, indent + 1);
					}
					continue;
				}

				// Scalar attribute
				const isFound =
					val !== undefined &&
					val !== null &&
					(typeof val === 'string'
						? val.trim().length > 0
						: Array.isArray(val)
							? val.length > 0
							: true);

				let status = 'Missing in Document';
				let statusClass = 'bg-slate-800 text-slate-400 border-slate-700';

				if (hasIssue) {
					status = 'Invalid Value';
					statusClass = 'bg-rose-950 text-rose-300 border-rose-800 font-semibold';
				} else if (isFound) {
					status = 'Successfully Mapped';
					statusClass = 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
				} else if (attr.required) {
					status = 'Needs Manual Review';
					statusClass = 'bg-rose-950/80 text-rose-300 border-rose-800 font-semibold';
				}

				result.push({
					field: fieldPath,
					type: attr.type,
					required: Boolean(attr.required),
					extractedContent: fieldNote?.note || (isFound ? 'Found in document' : 'None'),
					mappedValue: formatPreview(val),
					status,
					statusClass,
					indent,
					isHeader: false
				});
			}
		}

		processAttributes(attributes, data);

		// Unmapped extra document sections
		for (const item of unmapped || []) {
			const label = item.text
				? item.text.slice(0, 45) + (item.text.length > 45 ? '...' : '')
				: item.reason || 'Extra Section';
			result.push({
				field: label,
				type: 'unmapped text',
				required: false,
				extractedContent: item.text || 'Extra content',
				mappedValue: 'Ignored (Not in schema)',
				status: 'No Matching Schema Field',
				statusClass: 'bg-slate-900 text-slate-500 border-slate-800',
				indent: 0,
				isExtra: true,
				isHeader: false
			});
		}

		return result;
	});

	let mappedCount = $derived(rows.filter((r) => r.status === 'Successfully Mapped').length);
	let missingCount = $derived(rows.filter((r) => r.status === 'Missing in Document').length);
	let needsReviewCount = $derived(rows.filter((r) => r.status === 'Needs Manual Review' || r.status === 'Invalid Value').length);
	let extraCount = $derived(rows.filter((r) => r.status === 'No Matching Schema Field').length);
</script>

<div class="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl sm:p-5">
	<div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
		<div class="flex items-center gap-3">
			<div
				class="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-700/80 bg-indigo-950/80 text-base font-bold text-indigo-400"
			>
				📊
			</div>
			<div>
				<h3 class="flex items-center gap-2 text-sm font-bold text-white">
					<span>Schema-Aware Mapping & Content Preview</span>
					<span
						class="rounded-full bg-slate-800 px-2.5 py-0.5 font-mono text-[11px] font-normal text-indigo-300"
					>
						{schema?.displayName || schema?.singularName}
					</span>
				</h3>
				<p class="text-xs text-slate-400">
					Preview of extracted content mapped onto the Strapi collection and component fields.
				</p>
			</div>
		</div>

		<!-- Status Pills Summary -->
		<div class="flex items-center gap-2 text-xs">
			<span class="rounded-lg border border-emerald-800/80 bg-emerald-950/60 px-2.5 py-1 text-emerald-300">
				✓ {mappedCount} Mapped
			</span>
			{#if missingCount > 0}
				<span class="rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-1 text-slate-400">
					○ {missingCount} Empty
				</span>
			{/if}
			{#if needsReviewCount > 0}
				<span class="rounded-lg border border-rose-800/80 bg-rose-950/60 px-2.5 py-1 font-semibold text-rose-300">
					⚠️ {needsReviewCount} Needs Input
				</span>
			{/if}
			{#if extraCount > 0}
				<span class="rounded-lg border border-slate-800 bg-slate-950/80 px-2.5 py-1 text-slate-400">
					ℹ️ {extraCount} Extra Ignored
				</span>
			{/if}
			<button
				type="button"
				class="ml-2 text-xs font-semibold text-slate-400 hover:text-white"
				onclick={() => (collapsed = !collapsed)}
			>
				{collapsed ? 'Show Table' : 'Hide Table'}
			</button>
		</div>
	</div>

	{#if needsReviewCount > 0}
		<div
			class="flex items-start gap-2.5 rounded-xl border border-rose-800/80 bg-rose-950/60 p-3 text-xs text-rose-200"
		>
			<span class="text-sm text-rose-400">⚠️</span>
			<div>
				<strong>Required Field(s) Need Manual Input:</strong>
				{needsReviewCount} required field(s) were not found in the document. Please fill them in the form
				below before submitting.
			</div>
		</div>
	{/if}

	{#if !collapsed}
		<div class="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
			<table class="w-full text-left text-xs">
				<thead>
					<tr class="border-b border-slate-800 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
						<th class="px-3 py-2.5">Strapi Field</th>
						<th class="px-3 py-2.5">Field Type</th>
						<th class="px-3 py-2.5">Extracted Document Content</th>
						<th class="px-3 py-2.5">Mapped Value</th>
						<th class="px-3 py-2.5">Mapping Status</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-800/50">
					{#each rows as row}
						<tr
							class="transition hover:bg-slate-900/60 {row.isHeader ? 'bg-slate-900/40 font-semibold' : ''} {row.status === 'Needs Manual Review' || row.status === 'Invalid Value' ? 'bg-rose-950/20' : ''}"
						>
							<td class="px-3 py-2.5 text-slate-200 font-medium" style="padding-left: {row.indent * 1.25 + 0.75}rem">
								{#if !row.isExtra && onSelectField}
									<button
										type="button"
										class="cursor-pointer text-left hover:text-indigo-400 hover:underline"
										onclick={() => onSelectField(row.field)}
									>
										{row.field}
										{#if row.required}
											<span class="font-bold text-rose-400">*</span>
										{/if}
									</button>
								{:else}
									<span class={row.isExtra ? 'text-slate-400 italic' : ''}>
										{row.field}
									</span>
								{/if}
							</td>
							<td class="px-3 py-2.5 font-mono text-[11px] text-slate-400">
								{row.type}
							</td>
							<td class="px-3 py-2.5 max-w-[220px] truncate text-slate-400 text-[11px]" title={row.extractedContent}>
								{row.extractedContent}
							</td>
							<td class="px-3 py-2.5 max-w-[240px] truncate font-mono text-[11px] text-slate-300" title={row.mappedValue}>
								{row.mappedValue}
							</td>
							<td class="px-3 py-2.5">
								<span class="inline-block rounded-md border px-2 py-0.5 text-[10px] whitespace-nowrap {row.statusClass}">
									{row.status}
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
