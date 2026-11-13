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

<div
	role="status"
	class="space-y-4 rounded-2xl border border-emerald-500/35 bg-emerald-500/8 p-5 text-center shadow-lg sm:p-6"
>
	<div
		class="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
	>
		<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
			<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
		</svg>
	</div>

	<div class="space-y-1.5">
		<h3 class="text-base font-bold text-white sm:text-lg">Draft Created Successfully in Strapi!</h3>
		<p class="mx-auto max-w-md text-xs leading-relaxed text-slate-300">
			The entry has been created in <span class="font-semibold text-emerald-300">DRAFT</span> status.
			It will not be published until you explicitly publish it in the CMS.
		</p>
	</div>

	<div
		class="inline-flex max-w-full flex-wrap items-center justify-center gap-3 rounded-xl border border-slate-800 bg-[#0b0e14] px-4 py-2 font-mono text-xs tabular-nums"
	>
		<div>
			<span class="text-slate-400">ID:</span>
			<span class="ml-1 font-semibold text-white">{result.entryId || result.documentId}</span>
		</div>
		{#if result.documentId}
			<div class="border-l border-slate-800 pl-3 break-all">
				<span class="text-slate-400">DocumentId:</span>
				<span class="ml-1 text-indigo-300">{result.documentId}</span>
			</div>
		{/if}
	</div>

	<div class="flex flex-col items-center justify-center gap-2.5 pt-1 sm:flex-row">
		{#if result.adminUrl}
			<a
				href={result.adminUrl}
				target="_blank"
				rel="noreferrer"
				class="df-btn-primary w-full px-4 py-2 text-xs sm:w-auto"
			>
				<span>Open in Strapi Admin</span>
				<svg
					class="h-3.5 w-3.5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
					/>
				</svg>
			</a>
		{/if}

		<a href="/" class="df-btn-secondary w-full px-4 py-2 text-xs sm:w-auto">
			Import Another Document
		</a>
	</div>
</div>
