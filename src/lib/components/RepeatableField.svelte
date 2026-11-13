<script>
	import SchemaForm from './SchemaForm.svelte';

	/**
	 * @type {{
	 *   schema: any,
	 *   value?: any[],
	 *   jobId: string,
	 *   images?: any[],
	 *   pathPrefix?: string,
	 *   fieldNotes?: any[],
	 *   onfocusfield?: (path: string) => void,
	 *   onchange?: (val: any[]) => void
	 * }}
	 */
	let {
		schema,
		value = $bindable([]),
		jobId,
		images = [],
		pathPrefix = '',
		fieldNotes = [],
		onfocusfield,
		onchange
	} = $props();

	// Track collapsed state per index
	let collapsedMap = $state({});

	function toggleCollapse(idx) {
		collapsedMap[idx] = !collapsedMap[idx];
	}

	function addItem() {
		const newItem = {};
		// Initialize defaults if any
		for (const [k, attr] of Object.entries(schema?.attributes || {})) {
			if (attr.default !== null && attr.default !== undefined) {
				newItem[k] = attr.default;
			}
		}
		value = [...(value || []), newItem];
		if (onchange) onchange(value);
	}

	function removeItem(idx) {
		value = (value || []).filter((_, i) => i !== idx);
		if (onchange) onchange(value);
	}

	function moveItem(idx, direction) {
		const targetIdx = idx + direction;
		if (targetIdx < 0 || targetIdx >= (value || []).length) return;

		const list = [...(value || [])];
		const temp = list[idx];
		list[idx] = list[targetIdx];
		list[targetIdx] = temp;

		value = list;
		if (onchange) onchange(value);
	}

	function updateItem(idx, itemVal) {
		const list = [...(value || [])];
		list[idx] = itemVal;
		value = list;
		if (onchange) onchange(value);
	}
</script>

<div class="space-y-3">
	{#each value || [] as item, idx}
		<div class="overflow-hidden rounded-xl border border-slate-800/90 bg-[#0b0e14]">
			<!-- Item Header -->
			<div
				class="flex items-center justify-between gap-2 border-b border-slate-800/80 bg-[#151b24]/70 px-3 py-2 text-xs"
			>
				<button
					type="button"
					aria-expanded={!collapsedMap[idx]}
					class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
					onclick={() => toggleCollapse(idx)}
				>
					<svg
						class="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform {collapsedMap[idx]
							? ''
							: 'rotate-90'}"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2.5"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
					</svg>
					<span class="truncate font-semibold text-slate-200">
						Item #{idx + 1}
						{#if item.title || item.question || item.name}
							<span class="ml-1 font-normal text-slate-400">
								&mdash; {item.title || item.question || item.name}
							</span>
						{/if}
					</span>
				</button>

				<!-- Actions: Reorder Up, Reorder Down, Remove -->
				<div class="flex shrink-0 items-center gap-1 text-slate-400">
					<button
						type="button"
						disabled={idx === 0}
						aria-label="Move item up"
						class="cursor-pointer rounded-md p-1.5 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
						title="Move up"
						onclick={() => moveItem(idx, -1)}
					>
						&uarr;
					</button>
					<button
						type="button"
						disabled={idx === (value || []).length - 1}
						aria-label="Move item down"
						class="cursor-pointer rounded-md p-1.5 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
						title="Move down"
						onclick={() => moveItem(idx, 1)}
					>
						&darr;
					</button>
					<button
						type="button"
						aria-label="Remove item"
						class="ml-0.5 cursor-pointer rounded-md p-1.5 text-slate-500 transition hover:bg-rose-500/15 hover:text-rose-300"
						title="Remove item"
						onclick={() => removeItem(idx)}
					>
						&times;
					</button>
				</div>
			</div>

			<!-- Item Fields Form -->
			{#if !collapsedMap[idx]}
				<div class="space-y-3 p-3.5">
					<SchemaForm
						{schema}
						data={item}
						{jobId}
						{images}
						pathPrefix={`${pathPrefix}${idx}.`}
						{fieldNotes}
						{onfocusfield}
						onchange={(newVal) => updateItem(idx, newVal)}
					/>
				</div>
			{/if}
		</div>
	{/each}

	<button
		type="button"
		class="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-700/80 bg-[#0b0e14]/60 px-3 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-indigo-500/70 hover:bg-indigo-500/10 hover:text-white"
		onclick={addItem}
	>
		<span class="text-sm font-bold text-indigo-400">+</span>
		<span>Add {schema?.displayName || 'Item'}</span>
	</button>
</div>
