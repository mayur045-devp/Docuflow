<script>
	import SourceViewer from '$lib/components/SourceViewer.svelte';
	import SchemaForm from '$lib/components/SchemaForm.svelte';
	import IssuesPanel from '$lib/components/IssuesPanel.svelte';
	import PayloadPreview from '$lib/components/PayloadPreview.svelte';
	import ImportResult from '$lib/components/ImportResult.svelte';
	import MappingSummaryTable from '$lib/components/MappingSummaryTable.svelte';

	let { data } = $props();

	let job = $derived(data.job);
	let schema = $derived(data.schema);
	let documentModel = $derived(data.document);

	// Working copy of content data
	let formData = $state(data.review?.data || data.extraction?.data || {});
	let fieldNotes = $derived(data.extraction?.fieldNotes || []);
	let warnings = $derived(data.extraction?.warnings || []);
	let issues = $state(data.review?.issues || data.extraction?.issues || []);

	// Active highlighted source block IDs
	let activeHighlightIds = $state([]);

	// Human approval checkbox (Principle 3)
	let approved = $state(data.review?.approved || false);
	let savingReview = $state(false);
	let importing = $state(false);
	let dryRunning = $state(false);

	let dryRunResult = $state(null);
	let importResult = $state(data.result || null);
	let duplicatePrompt = $state(null);
	let statusMessage = $state('');
	let errorMessage = $state('');

	function handleFocusField(path) {
		const note = fieldNotes.find((n) => n.path === path || path.endsWith(n.path));
		if (note && note.sourceBlockIds) {
			activeHighlightIds = note.sourceBlockIds;
			// Scroll source block into view
			if (note.sourceBlockIds[0]) {
				const blockEl = window.document.getElementById(`source-block-${note.sourceBlockIds[0]}`);
				if (blockEl) {
					blockEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
				}
			}
		}
	}

	async function saveReview() {
		savingReview = true;
		statusMessage = '';
		errorMessage = '';

		try {
			const res = await fetch(`/api/jobs/${job.id}/review`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ data: formData, approved })
			});

			const json = await res.json();
			if (!res.ok) throw new Error(json.error?.message || 'Failed to save review');

			issues = json.issues || [];
			statusMessage = 'Changes saved and revalidated successfully.';
			setTimeout(() => (statusMessage = ''), 3000);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : String(err);
		} finally {
			savingReview = false;
		}
	}

	async function runDryRun() {
		dryRunning = true;
		errorMessage = '';
		duplicatePrompt = null;

		try {
			const res = await fetch(`/api/jobs/${job.id}/import`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ dryRun: true, approved: true })
			});

			const json = await res.json();
			if (!res.ok) throw new Error(json.error?.message || 'Dry run failed');

			dryRunResult = json;
			if (json.duplicateDetected) {
				duplicatePrompt = {
					existing: json.existingEntry,
					message: 'Entry with identical title or slug already exists in Strapi.'
				};
			}
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : String(err);
		} finally {
			dryRunning = false;
		}
	}

	async function runImport(onDuplicateChoice = 'cancel') {
		if (!approved) {
			errorMessage = 'You must review and check the approval confirmation before importing.';
			return;
		}

		importing = true;
		errorMessage = '';

		try {
			// First save any current edits
			await fetch(`/api/jobs/${job.id}/review`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ data: formData, approved: true })
			});

			const res = await fetch(`/api/jobs/${job.id}/import`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					approved: true,
					dryRun: false,
					onDuplicate: onDuplicateChoice,
					publish: false // Drafts by default! (Principle 5)
				})
			});

			const json = await res.json();

			if (json.duplicate) {
				duplicatePrompt = json;
				importing = false;
				return;
			}

			if (!res.ok) {
				throw new Error(json.error?.message || 'Import failed');
			}

			importResult = json;
			job.state = 'imported';
			duplicatePrompt = null;
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : String(err);
		} finally {
			importing = false;
		}
	}
</script>

<div class="flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
	<!-- Top Bar -->
	<div
		class="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-800 bg-slate-950 px-4 sm:px-6"
	>
		<div class="flex items-center gap-3">
			<a href="/" class="flex items-center gap-1 text-xs text-slate-400 hover:text-white">
				&larr; <span class="hidden sm:inline">Back</span>
			</a>
			<div class="h-4 w-px bg-slate-800"></div>
			<div>
				<h2 class="flex items-center gap-2 text-sm font-bold text-white">
					<span>{job.originalFilename}</span>
					<span
						class="rounded-full border border-indigo-800/80 bg-indigo-950/60 px-2 py-0.5 font-mono text-xs font-normal text-indigo-400"
					>
						{schema?.displayName || job.contentTypeUid}
					</span>
				</h2>
			</div>
		</div>

		<div class="flex items-center gap-2.5">
			{#if statusMessage}
				<span class="animate-fade-in hidden text-xs font-medium text-emerald-400 md:inline">
					{statusMessage}
				</span>
			{/if}

			<button
				type="button"
				disabled={savingReview}
				class="cursor-pointer rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
				onclick={saveReview}
			>
				{savingReview ? 'Saving...' : 'Save Edits'}
			</button>

			<button
				type="button"
				disabled={dryRunning}
				class="cursor-pointer rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
				onclick={runDryRun}
			>
				{dryRunning ? 'Checking...' : 'Dry Run Preview'}
			</button>
		</div>
	</div>

	<!-- Main Split Work Area -->
	<div class="grid flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-12">
		<!-- Left Column: Source Document Viewer (5 cols) -->
		<div class="h-full overflow-hidden border-r border-slate-800 bg-slate-950 p-4 lg:col-span-5">
			<SourceViewer
				jobId={job.id}
				document={documentModel}
				highlightBlockIds={activeHighlightIds}
			/>
		</div>

		<!-- Right Column: Schema Review Form & Import Panel (7 cols) -->
		<div class="h-full space-y-6 overflow-y-auto bg-slate-950 p-4 sm:p-6 lg:col-span-7">
			{#if errorMessage}
				<div
					class="flex items-start gap-2.5 rounded-xl border border-rose-800 bg-rose-950/80 p-3.5 text-xs text-rose-200"
				>
					<span class="font-bold text-rose-400">&times;</span>
					<div>{errorMessage}</div>
				</div>
			{/if}

			<!-- Import Result Success State -->
			{#if importResult && importResult.success}
				<ImportResult result={importResult} />
			{/if}

			<!-- Duplicate Detection Alert -->
			{#if duplicatePrompt}
				<div class="space-y-3 rounded-xl border border-amber-800/80 bg-amber-950/40 p-4">
					<div class="flex items-center gap-2 text-sm font-bold text-amber-300">
						<svg
							class="h-5 w-5 text-amber-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/>
						</svg>
						<span>Existing Entry Detected</span>
					</div>
					<p class="text-xs text-slate-300">
						An entry with matching slug or title already exists in Strapi. How would you like to
						proceed?
					</p>
					<div class="flex flex-wrap items-center gap-2 pt-1">
						<button
							type="button"
							class="cursor-pointer rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
							onclick={() => runImport('create_new')}
						>
							Create New (auto-suffix slug)
						</button>
						<button
							type="button"
							class="cursor-pointer rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
							onclick={() => runImport('update')}
						>
							Update Existing Draft
						</button>
						<button
							type="button"
							class="cursor-pointer rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
							onclick={() => (duplicatePrompt = null)}
						>
							Cancel
						</button>
					</div>
				</div>
			{/if}

			<!-- Schema Mapping & Content Coverage Overview (Requirement 6) -->
			<MappingSummaryTable
				{schema}
				data={formData}
				{fieldNotes}
				unmapped={data.extraction?.unmapped || []}
				{issues}
				onSelectField={handleFocusField}
			/>

			<!-- Issues & Warnings Panel -->
			<IssuesPanel {issues} {warnings} onSelectField={handleFocusField} />

			<!-- Form Generator -->
			<div class="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
				<div class="flex items-center justify-between border-b border-slate-800 pb-3">
					<div>
						<h3 class="text-sm font-bold text-white">Field-by-Field Review</h3>
						<p class="text-xs text-slate-400">
							Clicking any field highlights its source in the document.
						</p>
					</div>
				</div>

				<SchemaForm
					{schema}
					data={formData}
					jobId={job.id}
					images={documentModel?.images || []}
					{fieldNotes}
					{issues}
					onfocusfield={handleFocusField}
					onchange={(val) => {
						formData = val;
					}}
				/>
			</div>

			<!-- Payload Preview (Collapsible) -->
			<PayloadPreview payload={dryRunResult?.payload || formData} />

			<!-- Approval & Import Card -->
			<div class="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl">
				<div class="space-y-2">
					<label class="flex cursor-pointer items-start gap-3 select-none">
						<input
							type="checkbox"
							bind:checked={approved}
							class="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
						/>
						<div class="text-xs">
							<span class="font-semibold text-white">Human Approval Verified</span>
							<p class="mt-0.5 text-slate-400">
								I have reviewed the extracted content and confirm this entry is ready to be created
								as a <strong class="text-slate-200">draft</strong> in Strapi.
							</p>
						</div>
					</label>
				</div>

				<div class="flex items-center gap-3 pt-2">
					<button
						type="button"
						disabled={!approved || importing || job.state === 'imported'}
						class="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 disabled:opacity-40"
						onclick={() => runImport('cancel')}
					>
						{#if importing}
							<svg class="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								></circle>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
								></path>
							</svg>
							<span>Importing Draft to Strapi...</span>
						{:else if job.state === 'imported'}
							<span>Already Imported</span>
						{:else}
							<span>Approve & Create Draft in Strapi</span>
						{/if}
					</button>
				</div>
			</div>
		</div>
	</div>
</div>
