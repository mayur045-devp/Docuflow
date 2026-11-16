<script>
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();
	let deletedIds = $state([]);
	let deletingIds = $state([]);
	let deleteError = $state('');
	let deleteMessage = $state('');
	let jobs = $derived((data.jobs || []).filter((job) => !deletedIds.includes(job.id)));

	onMount(() => {
		const timer = setInterval(() => {
			if (document.visibilityState === 'visible') invalidateAll().catch(() => {});
		}, 60 * 1000);
		return () => clearInterval(timer);
	});

	async function removeJob(job) {
		if (deletingIds.includes(job.id)) return;
		deletingIds = [...deletingIds, job.id];
		deleteError = '';
		deleteMessage = '';
		try {
			const response = await fetch(`/api/jobs/${encodeURIComponent(job.id)}`, { method: 'DELETE' });
			if (!response.ok && response.status !== 404) {
				const result = await response.json();
				throw new Error(result.error?.message || 'Could not delete this history entry.');
			}
			deletedIds = [...deletedIds, job.id];
			deleteMessage = `Deleted ${job.originalFilename} and its saved processing files.`;
			// The row is already removed; refresh duplicate flags and other jobs when possible.
			invalidateAll().catch(() => {});
		} catch (err) {
			deleteError = err instanceof Error ? err.message : 'Could not delete this history entry.';
		} finally {
			deletingIds = deletingIds.filter((id) => id !== job.id);
		}
	}

	function formatDate(iso) {
		if (!iso) return '-';
		try {
			const d = new Date(iso);
			return (
				d.toLocaleDateString() +
				' ' +
				d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
			);
		} catch {
			return iso;
		}
	}

	function statusPillClass(state) {
		if (state === 'imported') {
			return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
		}
		if (state === 'failed') {
			return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
		}
		return 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300';
	}
</script>

<div class="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="space-y-1">
			<h1 class="text-xl font-bold tracking-tight text-white sm:text-2xl">Import History</h1>
			<p class="text-xs leading-relaxed text-slate-400 sm:text-sm">
				Audit log of all uploaded documents, extraction jobs, and Strapi CMS imports.
			</p>
			<p class="text-xs leading-relaxed text-slate-400">
				History and saved files are automatically deleted {data.retentionDays} days after upload. Delete
				removes them immediately. Imported Strapi content is kept.
			</p>
		</div>
		<a href="/" class="df-btn-primary w-full px-4 py-2 text-xs sm:w-auto"> + New Import </a>
	</div>
	{#if deleteError}
		<p
			role="alert"
			class="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300"
		>
			{deleteError}
		</p>
	{/if}
	{#if deleteMessage}
		<p role="status" class="text-sm text-emerald-300">{deleteMessage}</p>
	{/if}

	<div class="df-card overflow-hidden">
		{#if jobs.length === 0}
			<div class="flex flex-col items-center justify-center px-4 py-16 text-center">
				<div
					class="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-800 bg-[#0b0e14] text-slate-500"
				>
					<svg
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="1.75"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				</div>
				<p class="text-xs text-slate-400 sm:text-sm">
					No import jobs yet.
					<a href="/" class="font-semibold text-indigo-400 underline hover:text-indigo-300">
						Upload your first document
					</a>.
				</p>
			</div>
		{:else}
			<!-- Desktop & Tablet Table -->
			<div class="hidden overflow-x-auto md:block">
				<table class="min-w-full divide-y divide-slate-800/80 text-xs">
					<thead class="bg-[#0b0e14] text-[11px] tracking-wider text-slate-400 uppercase">
						<tr>
							<th class="px-4 py-3.5 text-left font-semibold">Document</th>
							<th class="px-4 py-3.5 text-left font-semibold">Content Type</th>
							<th class="px-4 py-3.5 text-left font-semibold">Status</th>
							<th class="px-4 py-3.5 text-left font-semibold">Strapi ID</th>
							<th class="px-4 py-3.5 text-left font-semibold">Date</th>
							<th class="px-4 py-3.5 text-right font-semibold">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-800/60 text-slate-300">
						{#each jobs as job}
							<tr class="transition hover:bg-[#151b24]/70">
								<td class="px-4 py-3.5 font-medium text-white">
									<div class="flex flex-wrap items-center gap-2">
										<span class="break-all">{job.originalFilename}</span>
										{#if job.duplicateDoc}
											<span
												class="rounded-md border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-300"
												title="Same document file was uploaded previously"
											>
												DUPLICATE FILE
											</span>
										{/if}
									</div>
									<div class="mt-1 font-mono text-[10px] text-slate-500 tabular-nums">
										SHA: {job.sha256?.substring(0, 10)}... &bull; {(job.fileSize / 1024).toFixed(1)} KB
									</div>
								</td>

								<td class="px-4 py-3.5">
									<span
										class="inline-block rounded-md border border-indigo-500/25 bg-indigo-500/10 px-2 py-0.5 font-mono text-[11px] text-indigo-300"
									>
										{job.contentTypeUid}
									</span>
								</td>

								<td class="px-4 py-3.5">
									<span
										class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase {statusPillClass(
											job.state
										)}"
									>
										{job.state}
									</span>
								</td>

								<td class="px-4 py-3.5 font-mono tabular-nums">
									{#if job.strapiEntryId || job.strapiDocumentId}
										<span class="font-bold text-emerald-300">
											#{job.strapiEntryId || job.strapiDocumentId}
										</span>
									{:else}
										<span class="text-slate-600">&mdash;</span>
									{/if}
								</td>

								<td class="px-4 py-3.5 whitespace-nowrap text-slate-400 tabular-nums">
									{formatDate(job.createdAt)}
								</td>

								<td class="px-4 py-3.5 text-right whitespace-nowrap">
									<div class="inline-flex items-center gap-2">
										{#if job.strapiAdminUrl}
											<a
												href={job.strapiAdminUrl}
												target="_blank"
												rel="noreferrer"
												class="rounded-lg px-2 py-1 font-semibold text-indigo-400 transition hover:bg-indigo-500/10 hover:text-indigo-300"
											>
												CMS &rarr;
											</a>
										{/if}
										<a
											href={`/jobs/${job.id}`}
											class="df-btn-secondary min-h-[30px] rounded-lg px-3 py-1 text-xs"
										>
											View
										</a>
										<button
											type="button"
											onclick={() => removeJob(job)}
											disabled={job.busy || deletingIds.includes(job.id)}
											aria-label={`Delete history for ${job.originalFilename}`}
											title={job.busy
												? 'Wait for processing to finish'
												: 'Permanently delete this history entry and saved files'}
											class="min-h-[30px] cursor-pointer rounded-lg border border-rose-500/30 px-3 py-1 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50"
										>
											{deletingIds.includes(job.id) ? 'Deleting...' : 'Delete'}
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Mobile Card List (< 768px) -->
			<div class="divide-y divide-slate-800/70 md:hidden">
				{#each jobs as job}
					<div class="space-y-3 p-4">
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0 space-y-1">
								<div class="text-sm font-semibold break-words text-white">
									{job.originalFilename}
								</div>
								{#if job.duplicateDoc}
									<span
										class="inline-block rounded-md border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-300"
									>
										DUPLICATE FILE
									</span>
								{/if}
							</div>
							<span
								class="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase {statusPillClass(
									job.state
								)}"
							>
								{job.state}
							</span>
						</div>

						<div class="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
							<span
								class="max-w-full truncate rounded-md border border-indigo-500/25 bg-indigo-500/10 px-2 py-0.5 font-mono text-indigo-300"
							>
								{job.contentTypeUid}
							</span>
							{#if job.strapiEntryId || job.strapiDocumentId}
								<span class="font-mono font-bold text-emerald-300 tabular-nums">
									#{job.strapiEntryId || job.strapiDocumentId}
								</span>
							{/if}
						</div>

						<div
							class="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-slate-500 tabular-nums"
						>
							<span>
								SHA: {job.sha256?.substring(0, 10)}... &bull; {(job.fileSize / 1024).toFixed(1)} KB
							</span>
							<span>{formatDate(job.createdAt)}</span>
						</div>

						<div class="flex items-center gap-2 pt-1">
							<a href={`/jobs/${job.id}`} class="df-btn-secondary flex-1 py-1.5 text-xs"> View </a>
							<button
								type="button"
								onclick={() => removeJob(job)}
								disabled={job.busy || deletingIds.includes(job.id)}
								aria-label={`Delete history for ${job.originalFilename}`}
								title={job.busy
									? 'Wait for processing to finish'
									: 'Permanently delete this history entry and saved files'}
								class="flex-1 cursor-pointer rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{deletingIds.includes(job.id) ? 'Deleting...' : 'Delete'}
							</button>
							{#if job.strapiAdminUrl}
								<a
									href={job.strapiAdminUrl}
									target="_blank"
									rel="noreferrer"
									class="df-btn-primary flex-1 py-1.5 text-xs"
								>
									CMS &rarr;
								</a>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
