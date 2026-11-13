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

	// Mobile/tablet split-pane tab switcher (< lg)
	let mobileTab = $state('review'); // 'review' | 'source'

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

<div class="flex flex-col lg:h-[calc(100dvh-4rem)] lg:overflow-hidden">
	<!-- Top Workspace Bar -->
	<div
		class="flex shrink-0 flex-col gap-2.5 border-b border-slate-800/80 bg-[#0b0e14] px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
	>
		<div class="flex min-w-0 items-center gap-2.5 sm:gap-3">
			<a
				href="/"
				class="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition hover:bg-slate-800/70 hover:text-white"
			>
				<span>&larr;</span>
				<span class="hidden sm:inline">Back</span>
			</a>
			<div class="h-4 w-px shrink-0 bg-slate-800"></div>
			<h2 class="flex min-w-0 flex-wrap items-center gap-2 text-sm font-bold text-white">
				<span class="truncate">{job.originalFilename}</span>
				<span
					class="shrink-0 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 font-mono text-[11px] font-medium text-indigo-300"
				>
					{schema?.displayName || job.contentTypeUid}
				</span>
			</h2>
		</div>

		<div class="flex flex-wrap items-center justify-end gap-2">
			{#if statusMessage}
				<span
					role="status"
					class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300"
				>
					{statusMessage}
				</span>
			{/if}

			<button
				type="button"
				disabled={savingReview}
				class="df-btn-secondary min-h-[34px] flex-1 px-3 py-1.5 text-xs sm:flex-initial"
				onclick={saveReview}
			>
				{savingReview ? 'Saving...' : 'Save Edits'}
			</button>

			<button
				type="button"
				disabled={dryRunning}
				class="df-btn-secondary min-h-[34px] flex-1 px-3 py-1.5 text-xs sm:flex-initial"
				onclick={runDryRun}
			>
				{dryRunning ? 'Checking...' : 'Dry Run Preview'}
			</button>
		</div>
	</div>

	<!-- Mobile & Tablet Pane Switcher (< 1024px) -->
	<div class="border-b border-slate-800/80 bg-[#090b10] px-4 py-2 lg:hidden">
		<div
			role="tablist"
			aria-label="Workspace view"
			class="grid grid-cols-2 gap-1 rounded-xl border border-slate-800 bg-[#0b0e14] p-1 text-xs"
		>
			<button
				type="button"
				role="tab"
				aria-selected={mobileTab === 'review'}
				class="cursor-pointer rounded-lg px-3 py-2 font-semibold transition {mobileTab === 'review'
					? 'bg-indigo-600 text-white shadow-sm'
					: 'text-slate-400 hover:text-white'}"
				onclick={() => (mobileTab = 'review')}
			>
				Review &amp; Mapping
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={mobileTab === 'source'}
				class="cursor-pointer rounded-lg px-3 py-2 font-semibold transition {mobileTab === 'source'
					? 'bg-indigo-600 text-white shadow-sm'
					: 'text-slate-400 hover:text-white'}"
				onclick={() => (mobileTab = 'source')}
			>
				Source Document
			</button>
		</div>
	</div>

	<!-- Main Split Work Area -->
	<div class="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-12 lg:overflow-hidden">
		<!-- Left Column: Source Document Viewer (5 cols) -->
		<div
			class="{mobileTab === 'source'
				? 'block'
				: 'hidden'} h-[72vh] min-h-0 bg-[#090b10] p-4 lg:col-span-5 lg:block lg:h-full lg:overflow-hidden lg:border-r lg:border-slate-800/80"
		>
			<SourceViewer
				jobId={job.id}
				document={documentModel}
				highlightBlockIds={activeHighlightIds}
			/>
		</div>

		<!-- Right Column: Schema Review Form & Import Panel (7 cols) -->
		<div
			class="{mobileTab === 'review'
				? 'block'
				: 'hidden'} min-h-0 space-y-5 bg-[#090b10] p-4 sm:p-6 lg:col-span-7 lg:block lg:h-full lg:overflow-y-auto"
		>
			{#if errorMessage}
				<div
					role="alert"
					class="flex items-start gap-2.5 rounded-xl border border-rose-500/35 bg-rose-500/10 p-3.5 text-xs text-rose-200"
				>
					<svg
						class="mt-0.5 h-4 w-4 shrink-0 text-rose-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<div class="min-w-0 flex-1 leading-relaxed">{errorMessage}</div>
				</div>
			{/if}

			<!-- Import Result Success State -->
			{#if importResult && importResult.success}
				<ImportResult result={importResult} />
			{/if}

			<!-- Duplicate Detection Alert -->
			{#if duplicatePrompt}
				<div
					role="alert"
					class="space-y-3 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 sm:p-5"
				>
					<div class="flex items-center gap-2 text-sm font-bold text-amber-200">
						<svg
							class="h-5 w-5 shrink-0 text-amber-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/>
						</svg>
						<span>Existing Entry Detected</span>
					</div>
					<p class="text-xs leading-relaxed text-slate-300">
						An entry with matching slug or title already exists in Strapi. How would you like to
						proceed?
					</p>
					<div class="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap sm:items-center">
						<button
							type="button"
							class="df-btn-primary px-3.5 py-2 text-xs"
							onclick={() => runImport('create_new')}
						>
							Create New (auto-suffix slug)
						</button>
						<button
							type="button"
							class="inline-flex min-h-[38px] cursor-pointer items-center justify-center rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-amber-500"
							onclick={() => runImport('update')}
						>
							Update Existing Draft
						</button>
						<button
							type="button"
							class="df-btn-secondary px-3.5 py-2 text-xs"
							onclick={() => (duplicatePrompt = null)}
						>
							Cancel
						</button>
					</div>
				</div>
			{/if}

			<!-- Schema Mapping & Content Coverage Overview -->
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
			<div class="df-card space-y-4 p-4 sm:p-5">
				<div class="border-b border-slate-800/80 pb-3">
					<h3 class="text-sm font-bold text-white">Field-by-Field Review</h3>
					<p class="mt-0.5 text-xs text-slate-400">
						Clicking any field highlights its source in the document.
					</p>
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
			<div class="df-card space-y-4 p-4 sm:p-5">
				<label class="flex cursor-pointer items-start gap-3 select-none">
					<input
						type="checkbox"
						bind:checked={approved}
						class="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-700 bg-[#0b0e14] text-indigo-600 focus:ring-indigo-500"
					/>
					<div class="text-xs leading-relaxed">
						<span class="font-semibold text-white">Human Approval Verified</span>
						<p class="mt-0.5 text-slate-400">
							I have reviewed the extracted content and confirm this entry is ready to be created as
							a <strong class="text-slate-200">draft</strong> in Strapi.
						</p>
					</div>
				</label>

				<div class="pt-1">
					<button
						type="button"
						disabled={!approved || importing || job.state === 'imported'}
						class="df-btn-primary w-full px-6 py-3 text-xs sm:text-sm"
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
							<span>Approve &amp; Create Draft in Strapi</span>
						{/if}
					</button>
				</div>
			</div>
		</div>
	</div>
</div>
