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
		<div class="overflow-hidden rounded-xl border border-indigo-500/25 bg-[#0b0e14]">
			<!-- Block Header -->
			<div
				class="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-500/15 bg-[#151b24]/80 px-3 py-2 text-xs"
			>
				<div class="flex min-w-0 flex-wrap items-center gap-2">
					<span
						class="truncate rounded-md border border-indigo-500/30 bg-indigo-500/12 px-2 py-0.5 font-mono text-[10px] text-indigo-300"
					>
						{block.__component}
					</span>
					<span class="font-medium text-slate-300">
						Block #{idx + 1}
					</span>
				</div>

				<div class="flex shrink-0 items-center gap-1 text-slate-400">
					<button
						type="button"
						disabled={idx === 0}
						aria-label="Move block up"
						class="cursor-pointer rounded-md p-1.5 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
						onclick={() => moveBlock(idx, -1)}
					>
						&uarr;
					</button>
					<button
						type="button"
						disabled={idx === (value || []).length - 1}
						aria-label="Move block down"
						class="cursor-pointer rounded-md p-1.5 transition hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
						onclick={() => moveBlock(idx, 1)}
					>
						&darr;
					</button>
					<button
						type="button"
						aria-label="Remove block"
						class="ml-0.5 cursor-pointer rounded-md p-1.5 text-slate-500 transition hover:bg-rose-500/15 hover:text-rose-300"
						onclick={() => removeBlock(idx)}
					>
						&times;
					</button>
				</div>
			</div>

			<!-- Form for Dynamic Component -->
			<div class="space-y-3 p-3.5">
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
					<div class="text-xs text-amber-300">
						Schema for component {block.__component} is not loaded.
					</div>
				{/if}
			</div>
		</div>
	{/each}

	<!-- Add Block Controls -->
	{#if components.length > 0}
		<div class="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center">
			<select bind:value={selectedCompUid} class="df-input flex-1 px-3 py-2 text-xs">
				{#each components as compUid}
					<option value={compUid} class="bg-[#0b0e14] text-white">
						{schemas[compUid]?.displayName || compUid}
					</option>
				{/each}
			</select>
			<button type="button" class="df-btn-primary shrink-0 px-3.5 py-2 text-xs" onclick={addBlock}>
				+ Add to Dynamic Zone
			</button>
		</div>
	{/if}
</div>
