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
	let { schema, data = {}, fieldNotes = [], unmapped = [], issues = [], onSelectField } = $props();

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
						let status = 'Missing → will remain empty';
						let statusClass = 'border-slate-700/80 bg-slate-800/70 text-slate-400';

						if (hasIssue) {
							status = 'Invalid Value';
							statusClass = 'border-rose-500/35 bg-rose-500/10 font-semibold text-rose-300';
						} else if (isFound) {
							status = 'Mapped from Document';
							statusClass = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
						} else if (attr.required) {
							status = 'Needs Manual Input';
							statusClass = 'border-rose-500/35 bg-rose-500/10 font-semibold text-rose-300';
						}

						result.push({
							field: fieldPath,
							source: isFound ? 'Document' : 'Missing',
							type: 'repeatable component',
							required: Boolean(attr.required),
							extractedContent: isFound
								? fieldNote?.note || `${items.length} items extracted`
								: 'Missing',
							mappedValue: isFound ? `${items.length} item(s)` : '—',
							status,
							statusClass,
							indent,
							isExtra: false,
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
						const isFound = Boolean(
							compVal &&
							Object.values(compVal).some(
								(v) => v !== '' && v !== null && (!Array.isArray(v) || v.length > 0)
							)
						);
						let status = 'Missing → will remain empty';
						let statusClass = 'border-slate-700/80 bg-slate-800/70 text-slate-400';

						if (hasIssue) {
							status = 'Invalid Value';
							statusClass = 'border-rose-500/35 bg-rose-500/10 font-semibold text-rose-300';
						} else if (isFound) {
							status = 'Mapped from Document';
							statusClass = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
						} else if (attr.required) {
							status = 'Needs Manual Input';
							statusClass = 'border-rose-500/35 bg-rose-500/10 font-semibold text-rose-300';
						}

						result.push({
							field: fieldPath,
							source: isFound ? 'Document' : 'Missing',
							type: 'single component',
							required: Boolean(attr.required),
							extractedContent: isFound ? fieldNote?.note || 'Component content found' : 'Missing',
							mappedValue: isFound ? 'Object populated' : '—',
							status,
							statusClass,
							indent,
							isExtra: false,
							isHeader: true
						});

						// Expand single component fields
						processAttributes(attr.schema?.attributes || {}, compVal || {}, fieldPath, indent + 1);
					}
					continue;
				}

				// Scalar attribute
				const isFound =
					fieldNote?.status === 'found' ||
					(val !== undefined &&
						val !== null &&
						(typeof val === 'string'
							? val.trim().length > 0
							: Array.isArray(val)
								? val.length > 0
								: true));

				let status = 'Missing → will remain empty';
				let statusClass = 'border-slate-700/80 bg-slate-800/70 text-slate-400';

				if (hasIssue) {
					status = 'Invalid Value';
					statusClass = 'border-rose-500/35 bg-rose-500/10 font-semibold text-rose-300';
				} else if (isFound) {
					status = 'Mapped from Document';
					statusClass = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
				} else if (attr.required) {
					status = 'Needs Manual Input';
					statusClass = 'border-rose-500/35 bg-rose-500/10 font-semibold text-rose-300';
				}

				result.push({
					field: fieldPath,
					source: isFound ? 'Document' : 'Missing',
					type: attr.type,
					required: Boolean(attr.required),
					extractedContent: isFound ? fieldNote?.note || 'Found in document' : 'Missing',
					mappedValue: isFound ? formatPreview(val) : '—',
					status,
					statusClass,
					indent,
					isExtra: false,
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
				source: 'Extra',
				type: 'unmapped text',
				required: false,
				extractedContent: item.text || 'Extra content',
				mappedValue: 'Ignored (Not in schema)',
				status: 'No Matching Schema Field',
				statusClass: 'border-slate-800 bg-slate-900 text-slate-500',
				indent: 0,
				isExtra: true,
				isHeader: false
			});
		}

		return result;
	});

	let mappedCount = $derived(rows.filter((r) => r.status === 'Mapped from Document').length);
	let missingCount = $derived(
		rows.filter((r) => r.status === 'Missing → will remain empty').length
	);
	let needsReviewCount = $derived(
		rows.filter((r) => r.status === 'Needs Manual Input' || r.status === 'Invalid Value').length
	);
	let extraCount = $derived(rows.filter((r) => r.status === 'No Matching Schema Field').length);
</script>

<div class="df-card space-y-4 p-4 sm:p-5">
	<div class="flex flex-col gap-3 border-b border-slate-800/80 pb-3.5">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div class="flex min-w-0 items-start gap-3">
				<div
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/12 text-indigo-300"
				>
					<svg
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
						/>
					</svg>
				</div>
				<div class="min-w-0">
					<h3 class="flex flex-wrap items-center gap-2 text-sm font-bold text-white">
						<span>Schema-Aware Mapping &amp; Content Preview</span>
						<span
							class="rounded-md border border-slate-700/80 bg-[#0b0e14] px-2 py-0.5 font-mono text-[11px] font-medium text-indigo-300"
						>
							{schema?.displayName || schema?.singularName}
						</span>
					</h3>
					<p class="mt-0.5 text-xs text-slate-400">
						Preview of extracted content mapped onto the Strapi collection and component fields.
					</p>
				</div>
			</div>

			<button
				type="button"
				aria-expanded={!collapsed}
				class="df-btn-secondary min-h-[30px] shrink-0 rounded-lg px-3 py-1 text-xs"
				onclick={() => (collapsed = !collapsed)}
			>
				{collapsed ? 'Show Table' : 'Hide Table'}
			</button>
		</div>

		<!-- Status Pills Summary -->
		<div class="flex flex-wrap items-center gap-2 text-xs tabular-nums">
			<span
				class="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-300"
			>
				<span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
				{mappedCount} Mapped
			</span>
			{#if missingCount > 0}
				<span
					class="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0b0e14] px-2.5 py-1 text-slate-400"
				>
					<span class="h-1.5 w-1.5 rounded-full bg-slate-500"></span>
					{missingCount} Empty in Document
				</span>
			{/if}
			{#if needsReviewCount > 0}
				<span
					class="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-500/10 px-2.5 py-1 font-semibold text-rose-300"
				>
					<span class="h-1.5 w-1.5 rounded-full bg-rose-400"></span>
					{needsReviewCount} Needs Input
				</span>
			{/if}
			{#if extraCount > 0}
				<span
					class="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0b0e14] px-2.5 py-1 text-slate-400"
				>
					{extraCount} Extra Ignored
				</span>
			{/if}
		</div>
	</div>

	{#if needsReviewCount > 0}
		<div
			role="alert"
			class="flex items-start gap-2.5 rounded-xl border border-rose-500/35 bg-rose-500/10 p-3.5 text-xs text-rose-200"
		>
			<svg
				class="mt-0.5 h-4 w-4 shrink-0 text-rose-400"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
				/>
			</svg>
			<div class="leading-relaxed">
				<strong>Required Field(s) Need Manual Input:</strong>
				{needsReviewCount} required field(s) were not found in the document. Please fill them in the form
				below before submitting.
			</div>
		</div>
	{/if}

	{#if !collapsed}
		<!-- Desktop / Tablet Table View -->
		<div class="hidden overflow-x-auto rounded-xl border border-slate-800/80 bg-[#0b0e14] sm:block">
			<table class="w-full text-left text-xs">
				<thead>
					<tr
						class="border-b border-slate-800/80 text-[11px] font-semibold tracking-wider text-slate-400 uppercase"
					>
						<th class="px-3.5 py-2.5">Field</th>
						<th class="px-3.5 py-2.5">Source</th>
						<th class="px-3.5 py-2.5">Type</th>
						<th class="px-3.5 py-2.5">Value</th>
						<th class="px-3.5 py-2.5">Status</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-800/60">
					{#each rows as row}
						<tr
							class="transition hover:bg-[#151b24]/60 {row.isHeader
								? 'bg-[#0f131a]/80 font-semibold'
								: ''} {row.status === 'Needs Manual Input' || row.status === 'Invalid Value'
								? 'bg-rose-500/5'
								: ''}"
						>
							<td
								class="px-3.5 py-2.5 font-medium text-slate-200"
								style="padding-left: {Math.min(row.indent, 4) * 1.15 + 0.875}rem"
							>
								{#if !row.isExtra && onSelectField}
									<button
										type="button"
										class="cursor-pointer text-left hover:text-indigo-300 hover:underline"
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
							<td class="px-3.5 py-2.5">
								<span
									class="inline-block rounded-md border px-2 py-0.5 font-mono text-[10px] {row.source ===
									'Document'
										? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300'
										: 'border-slate-800 bg-slate-900 text-slate-400'}"
								>
									{row.source || (row.isExtra ? 'Extra' : 'Document')}
								</span>
							</td>
							<td class="px-3.5 py-2.5 font-mono text-[11px] text-slate-400">
								{row.type}
							</td>
							<td
								class="max-w-[220px] truncate px-3.5 py-2.5 font-mono text-[11px] text-slate-300"
								title={row.mappedValue}
							>
								{row.mappedValue}
							</td>
							<td class="px-3.5 py-2.5">
								<span
									class="inline-block rounded-md border px-2 py-0.5 text-[10px] whitespace-nowrap {row.statusClass}"
								>
									{row.status}
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Mobile Card View (< 640px) -->
		<div
			class="divide-y divide-slate-800/70 rounded-xl border border-slate-800/80 bg-[#0b0e14] sm:hidden"
		>
			{#each rows as row}
				<div
					class="space-y-1.5 p-3 text-xs {row.status === 'Needs Manual Input' ||
					row.status === 'Invalid Value'
						? 'bg-rose-500/5'
						: ''}"
					style="padding-left: {Math.min(row.indent, 3) * 0.75 + 0.75}rem"
				>
					<div class="flex items-start justify-between gap-2">
						{#if !row.isExtra && onSelectField}
							<button
								type="button"
								class="min-w-0 cursor-pointer text-left font-semibold break-all text-slate-100 hover:text-indigo-300"
								onclick={() => onSelectField(row.field)}
							>
								{row.field}
								{#if row.required}
									<span class="font-bold text-rose-400">*</span>
								{/if}
							</button>
						{:else}
							<span
								class="min-w-0 font-medium break-all {row.isExtra
									? 'text-slate-400 italic'
									: 'text-slate-200'}"
							>
								{row.field}
							</span>
						{/if}
						<span class="shrink-0 font-mono text-[10px] text-slate-500">{row.type}</span>
					</div>

					<div class="truncate font-mono text-[11px] text-slate-300" title={row.mappedValue}>
						{row.mappedValue}
					</div>

					<div class="flex flex-wrap items-center gap-1.5 pt-0.5">
						<span
							class="inline-block rounded-md border px-1.5 py-0.5 font-mono text-[10px] {row.source ===
							'Document'
								? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300'
								: 'border-slate-800 bg-slate-900 text-slate-400'}"
						>
							{row.source || (row.isExtra ? 'Extra' : 'Document')}
						</span>
						<span
							class="inline-block rounded-md border px-1.5 py-0.5 text-[10px] {row.statusClass}"
						>
							{row.status}
						</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
