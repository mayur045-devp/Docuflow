<script>
	let { data } = $props();
	let jobs = $derived(data.jobs || []);

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
</script>

<div class="mx-auto max-w-6xl space-y-6 px-4 py-8">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight text-white">Import History</h1>
			<p class="mt-1 text-xs text-slate-400">
				Audit log of all uploaded documents, extraction jobs, and Strapi CMS imports.
			</p>
		</div>
		<a
			href="/"
			class="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-indigo-500"
		>
			+ New Import
		</a>
	</div>

	<div class="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
		{#if jobs.length === 0}
			<div class="py-16 text-center text-xs text-slate-500">
				No import jobs yet. <a href="/" class="font-semibold text-indigo-400 underline"
					>Upload your first document</a
				>.
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-slate-800 text-xs">
					<thead class="bg-slate-950/70 text-slate-400">
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
							<tr class="transition hover:bg-slate-800/40">
								<td class="px-4 py-3 font-medium text-white">
									<div class="flex items-center gap-2">
										<span>{job.originalFilename}</span>
										{#if job.duplicateDoc}
											<span
												class="rounded border border-amber-800 bg-amber-950 px-1.5 py-0.5 font-mono text-[10px] text-amber-400"
												title="Same document file was uploaded previously"
											>
												DUPLICATE FILE
											</span>
										{/if}
									</div>
									<div class="mt-0.5 font-mono text-[10px] text-slate-500">
										SHA: {job.sha256?.substring(0, 10)}... &bull; {(job.fileSize / 1024).toFixed(1)} KB
									</div>
								</td>

								<td class="px-4 py-3">
									<span
										class="rounded border border-indigo-900/60 bg-indigo-950/40 px-2 py-0.5 font-mono text-[11px] text-indigo-400"
									>
										{job.contentTypeUid}
									</span>
								</td>

								<td class="px-4 py-3">
									<span
										class="rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase
										{job.state === 'imported'
											? 'border border-emerald-800 bg-emerald-950 text-emerald-400'
											: job.state === 'failed'
												? 'border border-rose-800 bg-rose-950 text-rose-400'
												: 'border border-indigo-800 bg-indigo-950 text-indigo-400'}"
									>
										{job.state}
									</span>
								</td>

								<td class="px-4 py-3 font-mono">
									{#if job.strapiEntryId || job.strapiDocumentId}
										<span class="font-bold text-emerald-400"
											>#{job.strapiEntryId || job.strapiDocumentId}</span
										>
									{:else}
										<span class="text-slate-600">&mdash;</span>
									{/if}
								</td>

								<td class="px-4 py-3 whitespace-nowrap text-slate-400">
									{formatDate(job.createdAt)}
								</td>

								<td class="space-x-2 px-4 py-3 text-right">
									{#if job.strapiAdminUrl}
										<a
											href={job.strapiAdminUrl}
											target="_blank"
											rel="noreferrer"
											class="font-medium text-indigo-400 hover:text-indigo-300"
										>
											CMS &rarr;
										</a>
									{/if}
									<a
										href={`/jobs/${job.id}`}
										class="rounded-lg bg-slate-800 px-2.5 py-1 font-medium text-slate-200 transition hover:bg-slate-700"
									>
										View
									</a>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>
