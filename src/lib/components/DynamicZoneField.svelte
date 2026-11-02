<script>
	import SchemaForm from './SchemaForm.svelte';

	/**
	 * @type {{
	 *   id?: string,
	 *   components?: string[],
	 *   schemas?: Record<string, any>,
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
		components = [],
		schemas = {},
		value = $bindable([]),
		jobId,
		images = [],
		pathPrefix = '',
		fieldNotes = [],
		onfocusfield,
		onchange
	} = $props();

	let selectedCompUid = $state('');
	$effect(() => {
		if (!selectedCompUid && components[0]) {
			selectedCompUid = components[0];
		}
	});

	function addBlock() {
		if (!selectedCompUid) return;
		const newBlock = {
			__component: selectedCompUid
		};
		value = [...(value || []), newBlock];
		if (onchange) onchange(value);
	}

	function removeBlock(idx) {
		value = (value || []).filter((_, i) => i !== idx);
		if (onchange) onchange(value);
	}

	function moveBlock(idx, dir) {
		const targetIdx = idx + dir;
		if (targetIdx < 0 || targetIdx >= (value || []).length) return;
		const list = [...(value || [])];
		const temp = list[idx];
		list[idx] = list[targetIdx];
		list[targetIdx] = temp;
		value = list;
		if (onchange) onchange(value);
	}

	function updateBlock(idx, blockVal) {
		const list = [...(value || [])];
		list[idx] = blockVal;
		value = list;
		if (onchange) onchange(value);
	}
</script>

<div class="space-y-3">
	{#each value || [] as block, idx}
		{@const compSchema = schemas[block.__component]}
		<div class="overflow-hidden rounded-xl border border-indigo-900/60 bg-slate-950/80 shadow-sm">
			<!-- Block Header -->
			<div
				class="flex items-center justify-between border-b border-indigo-900/40 bg-slate-900/90 px-3 py-2 text-xs"
			>
				<div class="flex items-center gap-2">
					<span
						class="rounded border border-indigo-800 bg-indigo-950 px-2 py-0.5 font-mono text-[10px] text-indigo-300"
					>
						{block.__component}
					</span>
					<span class="font-medium text-slate-300">
						Block #{idx + 1}
					</span>
				</div>

				<div class="flex items-center gap-1 text-slate-400">
					<button
						type="button"
						disabled={idx === 0}
						class="cursor-pointer rounded p-1 hover:bg-slate-800 hover:text-white disabled:opacity-20"
						onclick={() => moveBlock(idx, -1)}
					>
						&uarr;
					</button>
					<button
						type="button"
						disabled={idx === (value || []).length - 1}
						class="cursor-pointer rounded p-1 hover:bg-slate-800 hover:text-white disabled:opacity-20"
						onclick={() => moveBlock(idx, 1)}
					>
						&darr;
					</button>
					<button
						type="button"
						class="ml-1 cursor-pointer rounded p-1 text-slate-500 hover:bg-rose-950 hover:text-rose-400"
						onclick={() => removeBlock(idx)}
					>
						&times;
					</button>
				</div>
			</div>

			<!-- Form for Dynamic Component -->
			<div class="space-y-3 bg-slate-950/40 p-3.5">
				{#if compSchema}
					<SchemaForm
						schema={compSchema}
						data={block}
						{jobId}
						{images}
						pathPrefix={`${pathPrefix}${idx}.`}
						{fieldNotes}
						{onfocusfield}
						onchange={(newVal) => updateBlock(idx, newVal)}
					/>
				{:else}
					<div class="text-xs text-amber-400">
						Schema for component {block.__component} is not loaded.
					</div>
				{/if}
			</div>
		</div>
	{/each}

	<!-- Add Block Controls -->
	{#if components.length > 0}
		<div class="flex items-center gap-2 pt-1">
			<select
				bind:value={selectedCompUid}
				class="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
			>
				{#each components as compUid}
					<option value={compUid}>
						{schemas[compUid]?.displayName || compUid}
					</option>
				{/each}
			</select>
			<button
				type="button"
				class="cursor-pointer rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow transition hover:bg-indigo-500"
				onclick={addBlock}
			>
				+ Add to Dynamic Zone
			</button>
		</div>
	{/if}
</div>
