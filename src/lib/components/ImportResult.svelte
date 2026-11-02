<script>
	/**
	 * @type {{
	 *   result: {
	 *     entryId?: number | string,
	 *     documentId?: string,
	 *     adminUrl?: string,
	 *     draft?: boolean,
	 *     warnings?: string[]
	 *   }
	 * }}
	 */
	let { result } = $props();
</script>

<div class="space-y-4 rounded-2xl border border-emerald-800/80 bg-emerald-950/20 p-6 text-center">
	<div
		class="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500 bg-emerald-500/20 text-emerald-400"
	>
		<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
		</svg>
	</div>

	<div class="space-y-1">
		<h3 class="text-lg font-bold text-white">Draft Created Successfully in Strapi!</h3>
		<p class="text-xs text-slate-300">
			The entry has been created in <span class="font-semibold text-emerald-400">DRAFT</span> status.
			It will not be published until you explicitly publish it in the CMS.
		</p>
	</div>

	<div
		class="inline-flex flex-wrap items-center justify-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 font-mono text-xs"
	>
		<div>
			<span class="text-slate-500">ID:</span>
			<span class="ml-1 font-semibold text-white">{result.entryId || result.documentId}</span>
		</div>
		{#if result.documentId}
			<div class="border-l border-slate-700 pl-3">
				<span class="text-slate-500">DocumentId:</span>
				<span class="ml-1 text-indigo-400">{result.documentId}</span>
			</div>
		{/if}
	</div>

	<div class="flex items-center justify-center gap-3 pt-2">
		{#if result.adminUrl}
			<a
				href={result.adminUrl}
				target="_blank"
				rel="noreferrer"
				class="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg transition hover:bg-indigo-500"
			>
				<span>Open in Strapi Admin</span>
				<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
					/>
				</svg>
			</a>
		{/if}

		<a
			href="/"
			class="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
		>
			Import Another Document
		</a>
	</div>
</div>
