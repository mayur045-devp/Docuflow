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
			class="flex items-center justify-between gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs"
		>
			<div class="flex min-w-0 items-center gap-2 font-medium text-indigo-200">
				<svg
					class="h-4 w-4 shrink-0 text-indigo-400"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
					/>
				</svg>
				<span class="truncate">{selectedLabel}</span>
			</div>
			<button
				type="button"
				class="shrink-0 cursor-pointer rounded-lg px-2 py-1 text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300"
				onclick={clearSelection}
				title="Remove relation"
				aria-label="Remove relation"
			>
				&times;
			</button>
		</div>
	{:else}
		<div class="relative">
			<svg
				class="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
				/>
			</svg>
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
				class="df-input py-2 pr-9 pl-8.5 text-xs"
			/>
			{#if searching}
				<div class="absolute top-1/2 right-3 -translate-y-1/2">
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
				class="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-700/80 bg-[#151b24] py-1 text-xs shadow-2xl"
			>
				{#if candidates.length === 0}
					<div class="p-3 text-center text-slate-400">
						{searching ? 'Searching...' : 'No relation candidates found'}
					</div>
				{:else}
					{#each candidates as item}
						<button
							type="button"
							class="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-slate-200 transition hover:bg-indigo-500/15 hover:text-white"
							onclick={() => selectCandidate(item)}
						>
							<span class="truncate">{item.label}</span>
							<span class="shrink-0 font-mono text-[10px] text-slate-500">#{item.id}</span>
						</button>
					{/each}
				{/if}
			</div>
		{/if}
	{/if}
</div>
