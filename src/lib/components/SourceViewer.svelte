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

<div class="df-card flex h-full min-h-[360px] flex-col overflow-hidden">
	<!-- Header -->
	<div
		class="flex flex-col gap-2.5 border-b border-slate-800/80 bg-[#0b0e14] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
	>
		<div class="flex items-center gap-2">
			<span class="h-2 w-2 shrink-0 rounded-full bg-emerald-500"></span>
			<h3 class="text-sm font-semibold text-slate-100">Source Document</h3>
			<span class="font-mono text-xs text-slate-500 tabular-nums">({blocks.length} blocks)</span>
		</div>

		<div class="relative w-full sm:w-48">
			<svg
				class="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
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
				type="text"
				aria-label="Find in document"
				bind:value={filterText}
				placeholder="Find in doc..."
				class="df-input py-1.5 pr-7 pl-8 text-xs"
			/>
			{#if filterText}
				<button
					type="button"
					aria-label="Clear search"
					onclick={() => (filterText = '')}
					class="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded p-0.5 text-slate-400 hover:text-white"
				>
					&times;
				</button>
			{/if}
		</div>
	</div>

	<!-- Blocks List -->
	<div class="flex-1 space-y-3 overflow-y-auto p-3.5 font-sans text-sm select-text sm:p-4">
		{#if filteredBlocks.length === 0}
			<div class="py-12 text-center text-xs text-slate-500">No blocks match your search.</div>
		{:else}
			{#each filteredBlocks as block}
				<div
					id={`source-block-${block.id}`}
					class="group rounded-xl border p-3.5 transition-all duration-150
						{isHighlighted(block.id)
						? 'border-indigo-400/70 bg-indigo-500/12 ring-2 ring-indigo-500/25'
						: 'border-slate-800/80 bg-[#0b0e14]/70 hover:border-slate-700'}"
				>
					<!-- Block Metadata Strip -->
					<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
						<span class="font-mono text-[10px] tracking-wider text-slate-500 uppercase">
							{block.type}{block.type === 'heading' && block.level ? ` · H${block.level}` : ''}
						</span>
						<div class="flex items-center gap-1.5">
							{#if block.inferredHeading}
								<span
									class="rounded-md border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300 uppercase"
								>
									Inferred H{block.level}
								</span>
							{/if}
							<span
								class="rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold transition-colors
									{isHighlighted(block.id)
									? 'border-indigo-400 bg-indigo-600 text-white'
									: 'border-slate-700/80 bg-slate-800/80 text-slate-400 group-hover:text-slate-200'}"
							>
								{block.id}
							</span>
						</div>
					</div>

					<!-- Block Content Rendering -->
					{#if block.type === 'heading'}
						<div
							class="font-bold tracking-tight break-words text-white
								{block.level === 1
								? 'border-b border-indigo-500/20 pb-1.5 text-base text-indigo-200 sm:text-lg'
								: block.level === 2
									? 'text-sm text-slate-100 sm:text-base'
									: 'text-sm text-slate-200'}"
						>
							{block.text}
						</div>
					{:else if block.type === 'paragraph'}
						<p class="text-[13px] leading-relaxed break-words whitespace-pre-wrap text-slate-300">
							{block.text}
						</p>
					{:else if block.type === 'quote'}
						<blockquote
							class="my-1 border-l-2 border-indigo-500 pl-3 text-[13px] text-slate-300 italic"
						>
							{block.text}
						</blockquote>
					{:else if block.type === 'list'}
						<ul class="my-1 space-y-1.5 text-[13px] text-slate-300">
							{#each block.items || [] as item}
								<li
									class="flex items-start gap-2"
									style="margin-left: {Math.min((item.level || 0) * 14, 42)}px"
								>
									<span class="font-bold text-indigo-400">&bull;</span>
									<span class="break-words">{item.text}</span>
								</li>
							{/each}
						</ul>
					{:else if block.type === 'table'}
						<div class="my-1 overflow-x-auto rounded-lg border border-slate-800 bg-[#090b10]">
							<table class="min-w-full divide-y divide-slate-800 text-xs">
								{#if block.rows && block.rows.length > 0}
									<tbody class="divide-y divide-slate-800/60">
										{#each block.rows as row, rIdx}
											<tr
												class={rIdx === 0 && block.headerRow
													? 'bg-[#151b24] font-semibold text-slate-100'
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
							class="my-1 flex flex-col items-center rounded-lg border border-slate-800 bg-[#090b10] p-2.5"
						>
							<img
								src={`/api/jobs/${jobId}/images/${block.imageId}`}
								alt={block.alt || 'Document image'}
								class="max-h-48 max-w-full rounded object-contain shadow"
								loading="lazy"
							/>
							{#if block.alt}
								<span class="mt-1.5 text-center text-xs text-slate-400 italic">{block.alt}</span>
							{/if}
							<span class="mt-0.5 font-mono text-[10px] text-slate-500">[{block.imageId}]</span>
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
</div>
