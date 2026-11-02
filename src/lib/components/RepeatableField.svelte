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
		<div class="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60 shadow-sm">
			<!-- Item Header -->
			<div
				class="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/80 px-3 py-2 text-xs"
			>
				<div class="flex items-center gap-2">
					<button
						type="button"
						class="cursor-pointer font-bold text-slate-400 hover:text-white"
						onclick={() => toggleCollapse(idx)}
					>
						{collapsedMap[idx] ? '+' : '–'}
					</button>
					<span class="font-semibold text-slate-300">
						Item #{idx + 1}
						{#if item.title || item.question || item.name}
							<span class="ml-1 font-normal text-slate-400">
								&mdash; {item.title || item.question || item.name}
							</span>
						{/if}
					</span>
				</div>

				<!-- Actions: Reorder Up, Reorder Down, Remove -->
				<div class="flex items-center gap-1 text-slate-400">
					<button
						type="button"
						disabled={idx === 0}
						class="cursor-pointer rounded p-1 hover:bg-slate-800 hover:text-white disabled:opacity-20"
						title="Move up"
						onclick={() => moveItem(idx, -1)}
					>
						&uarr;
					</button>
					<button
						type="button"
						disabled={idx === (value || []).length - 1}
						class="cursor-pointer rounded p-1 hover:bg-slate-800 hover:text-white disabled:opacity-20"
						title="Move down"
						onclick={() => moveItem(idx, 1)}
					>
						&darr;
					</button>
					<button
						type="button"
						class="ml-1 cursor-pointer rounded p-1 text-slate-500 hover:bg-rose-950/80 hover:text-rose-400"
						title="Remove item"
						onclick={() => removeItem(idx)}
					>
						&times;
					</button>
				</div>
			</div>

			<!-- Item Fields Form -->
			{#if !collapsedMap[idx]}
				<div class="space-y-3 bg-slate-950/40 p-3.5">
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
		class="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-indigo-500 hover:bg-indigo-950/20 hover:text-white"
		onclick={addItem}
	>
		<span class="text-sm font-bold text-indigo-400">+</span>
		<span>Add {schema?.displayName || 'Item'}</span>
	</button>
</div>
