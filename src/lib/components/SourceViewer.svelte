<script>
	/**
	 * @type {{
	 *   jobId: string,
	 *   document?: import('../server/document/model.js').DocumentModel | null,
	 *   highlightBlockIds?: string[]
	 * }}
	 */
	let { jobId, document = null, highlightBlockIds = [] } = $props();

	let filterText = $state('');

	let blocks = $derived(document?.blocks || []);
	let filteredBlocks = $derived(
		filterText.trim()
			? blocks.filter((b) => b.text.toLowerCase().includes(filterText.toLowerCase()))
			: blocks
	);

	function isHighlighted(blockId) {
		return highlightBlockIds && highlightBlockIds.includes(blockId);
	}
</script>

<div
	class="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl"
>
	<!-- Header -->
	<div
		class="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/70 p-3.5"
	>
		<div class="flex items-center gap-2">
			<span class="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
			<h3 class="text-sm font-semibold text-slate-200">Source Document</h3>
			<span class="font-mono text-xs text-slate-500">({blocks.length} blocks)</span>
		</div>

		<div class="relative w-44">
			<input
				type="text"
				bind:value={filterText}
				placeholder="Find in doc..."
				class="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
			/>
		</div>
	</div>

	<!-- Blocks List -->
	<div class="flex-1 space-y-3.5 overflow-y-auto p-4 font-sans text-sm select-text">
		{#if filteredBlocks.length === 0}
			<div class="py-12 text-center text-xs text-slate-500">No blocks match your search.</div>
		{:else}
			{#each filteredBlocks as block}
				<div
					id={`source-block-${block.id}`}
					class="group relative rounded-xl border p-3 transition-all duration-150
						{isHighlighted(block.id)
						? 'border-indigo-500/80 bg-indigo-950/40 ring-2 ring-indigo-500/30'
						: 'border-slate-800/80 bg-slate-950/40 hover:border-slate-700'}"
				>
					<!-- Block Badge -->
					<div class="absolute -top-2.5 right-3 flex items-center gap-1.5">
						<span
							class="rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold transition-colors
								{isHighlighted(block.id)
								? 'border-indigo-400 bg-indigo-600 text-white'
								: 'border-slate-700 bg-slate-800 text-slate-400 group-hover:text-slate-300'}"
						>
							{block.id}
						</span>
						{#if block.inferredHeading}
							<span
								class="rounded border border-amber-800 bg-amber-950 px-1 text-[9px] font-semibold text-amber-400 uppercase"
							>
								Inferred H{block.level}
							</span>
						{/if}
					</div>

					<!-- Block Content Rendering -->
					{#if block.type === 'heading'}
						<div
							class="font-bold tracking-tight text-white
								{block.level === 1
								? 'border-b border-indigo-950/60 pb-1 text-lg text-indigo-200'
								: block.level === 2
									? 'text-base text-slate-100'
									: 'text-sm text-slate-200'}"
						>
							{block.text}
						</div>
					{:else if block.type === 'paragraph'}
						<p class="leading-relaxed whitespace-pre-wrap text-slate-300">
							{block.text}
						</p>
					{:else if block.type === 'quote'}
						<blockquote class="my-1 border-l-2 border-indigo-500 pl-3 text-slate-400 italic">
							{block.text}
						</blockquote>
					{:else if block.type === 'list'}
						<ul class="my-1 space-y-1 text-slate-300">
							{#each block.items || [] as item}
								<li class="flex items-start gap-2" style="margin-left: {(item.level || 0) * 16}px">
									<span class="font-bold text-indigo-400">&bull;</span>
									<span>{item.text}</span>
								</li>
							{/each}
						</ul>
					{:else if block.type === 'table'}
						<div class="my-1 overflow-x-auto rounded-lg border border-slate-800">
							<table class="min-w-full divide-y divide-slate-800 text-xs">
								{#if block.rows && block.rows.length > 0}
									<tbody class="divide-y divide-slate-800/60">
										{#each block.rows as row, rIdx}
											<tr
												class={rIdx === 0 && block.headerRow
													? 'bg-slate-900 font-semibold text-slate-200'
													: 'text-slate-300'}
											>
												{#each row as cell}
													<td class="border-r border-slate-800/60 px-2.5 py-1.5 last:border-0">
														{cell}
													</td>
												{/each}
											</tr>
										{/each}
									</tbody>
								{/if}
							</table>
						</div>
					{:else if block.type === 'image'}
						<div
							class="my-2 flex flex-col items-center rounded-lg border border-slate-800 bg-slate-950/60 p-2"
						>
							<img
								src={`/api/jobs/${jobId}/images/${block.imageId}`}
								alt={block.alt || 'Document image'}
								class="max-h-48 max-w-full rounded object-contain shadow"
								loading="lazy"
							/>
							{#if block.alt}
								<span class="mt-1 text-xs text-slate-400 italic">{block.alt}</span>
							{/if}
							<span class="mt-0.5 font-mono text-[10px] text-slate-500">[{block.imageId}]</span>
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</div>
