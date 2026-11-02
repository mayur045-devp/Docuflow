<script>
	/**
	 * @type {{
	 *   id?: string,
	 *   target: string,
	 *   displayField?: string,
	 *   value?: any,
	 *   onchange?: (val: any) => void
	 * }}
	 */
	let {
		id = 'relation-field',
		target,
		displayField = 'name',
		value = $bindable(null),
		onchange
	} = $props();

	let searchQuery = $state('');
	let searching = $state(false);
	let candidates = $state([]);
	let showDropdown = $state(false);
	let debounceTimer = null;

	let selectedLabel = $derived.by(() => {
		if (!value) return '';
		if (typeof value === 'object') {
			return value.label || value.name || value.title || `ID: ${value.id || value.documentId}`;
		}
		return String(value);
	});

	function search(q) {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(async () => {
			searching = true;
			try {
				const res = await fetch(
					`/api/strapi/relations?target=${encodeURIComponent(target)}&q=${encodeURIComponent(q)}&displayField=${encodeURIComponent(displayField)}`
				);
				if (res.ok) {
					const json = await res.json();
					candidates = json.candidates || [];
				}
			} catch {
				candidates = [];
			} finally {
				searching = false;
			}
		}, 250);
	}

	function selectCandidate(item) {
		value = {
			id: item.id,
			documentId: item.documentId,
			label: item.label
		};
		showDropdown = false;
		if (onchange) onchange(value);
	}

	function clearSelection() {
		value = null;
		if (onchange) onchange(null);
	}
</script>

<div class="relative space-y-1.5">
	{#if selectedLabel}
		<div
			class="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900 p-2 text-xs"
		>
			<div class="flex items-center gap-2 font-medium text-indigo-300">
				<svg class="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
					/>
				</svg>
				<span>{selectedLabel}</span>
			</div>
			<button
				type="button"
				class="cursor-pointer rounded p-1 text-slate-400 hover:text-rose-400"
				onclick={clearSelection}
				title="Remove relation"
			>
				&times;
			</button>
		</div>
	{:else}
		<div class="relative">
			<input
				{id}
				type="text"
				placeholder="Search relation target..."
				bind:value={searchQuery}
				onfocus={() => {
					showDropdown = true;
					search(searchQuery);
				}}
				oninput={(e) => {
					showDropdown = true;
					search(e.currentTarget.value);
				}}
				class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 transition focus:border-indigo-500 focus:outline-none"
			/>
			{#if searching}
				<div class="absolute top-2.5 right-3">
					<svg class="h-3.5 w-3.5 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
						></path>
					</svg>
				</div>
			{/if}
		</div>

		{#if showDropdown}
			<div
				class="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 py-1 text-xs shadow-2xl"
			>
				{#if candidates.length === 0}
					<div class="p-2 text-center text-slate-500">
						{searching ? 'Searching...' : 'No relation candidates found'}
					</div>
				{:else}
					{#each candidates as item}
						<button
							type="button"
							class="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-slate-200 transition hover:bg-slate-800"
							onclick={() => selectCandidate(item)}
						>
							<span>{item.label}</span>
							<span class="font-mono text-[10px] text-slate-500">#{item.id}</span>
						</button>
					{/each}
				{/if}
			</div>
		{/if}
	{/if}
</div>
