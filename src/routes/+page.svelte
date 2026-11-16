<script>
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import Stepper from '$lib/components/Stepper.svelte';

	let file = $state(null);
	let isDragging = $state(false);
	let contentTypes = $state([]);
	let selectedContentTypeUid = $state('');
	let loadingSchemas = $state(true);
	let refreshingSchemas = $state(false);
	let testingConnection = $state(false);
	let connectionStatus = $state(null);

	let strapiUrl = $state('');
	let strapiVersion = $state('5');
	let componentsCount = $state(0);

	let uploading = $state(false);
	let extracting = $state(false);
	let extractStage = $state('');
	let errorMessage = $state('');

	let uploadedJob = $state(null);

	let selectedContentType = $derived(
		contentTypes.find((ct) => ct.uid === selectedContentTypeUid) || null
	);

	let collectionTypes = $derived(
		contentTypes.filter((ct) => (ct.kind || 'collectionType') === 'collectionType')
	);
	let singleTypes = $derived(contentTypes.filter((ct) => ct.kind === 'singleType'));

	async function onSelectCollection(uid) {
		selectedContentTypeUid = uid;
		try {
			const res = await fetch(`/api/schema?uid=${encodeURIComponent(uid)}&refresh=true`);
			if (res.ok) {
				const json = await res.json();
				if (json.selectedSchema) {
					const idx = contentTypes.findIndex((ct) => ct.uid === uid);
					if (idx !== -1) {
						contentTypes[idx] = json.selectedSchema;
					}
				}
			}
		} catch {
			// ignore
		}
	}

	async function testConnection() {
		testingConnection = true;
		errorMessage = '';
		try {
			const res = await fetch('/api/strapi/test', { method: 'POST' });
			const json = await res.json();
			connectionStatus = json;
			if (json.success) {
				strapiUrl = json.normalizedUrl || json.baseUrl;
				strapiVersion = json.version || '5';
				componentsCount = json.componentsCount || componentsCount;
			} else {
				errorMessage = json.message || 'Strapi connection test failed.';
			}
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Strapi connection test failed.';
			connectionStatus = { success: false, message: errorMessage };
		} finally {
			testingConnection = false;
		}
	}

	async function loadSchemas(forceRefresh = false) {
		if (forceRefresh) {
			refreshingSchemas = true;
		} else {
			loadingSchemas = true;
		}
		errorMessage = '';

		try {
			const res = await fetch(`/api/schema${forceRefresh ? '?refresh=true' : ''}`);
			if (res.ok) {
				const json = await res.json();
				contentTypes = Object.values(json.contentTypes || {});
				strapiUrl = json.strapiUrl || strapiUrl;
				strapiVersion = json.strapiVersion || strapiVersion;
				componentsCount = json.componentsCount || componentsCount;

				connectionStatus = {
					success: true,
					normalizedUrl: strapiUrl,
					version: strapiVersion,
					contentTypesCount: contentTypes.length,
					componentsCount,
					message: 'Strapi connection successful'
				};

				if (
					contentTypes.length > 0 &&
					(!selectedContentTypeUid || !contentTypes.some((ct) => ct.uid === selectedContentTypeUid))
				) {
					selectedContentTypeUid = contentTypes[0].uid;
				}
			} else {
				const errJson = await res.json();
				throw new Error(errJson.error?.message || 'Failed to retrieve Strapi schemas');
			}
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Could not load Strapi schema.';
			connectionStatus = {
				success: false,
				normalizedUrl: strapiUrl,
				message: errorMessage
			};
		} finally {
			loadingSchemas = false;
			refreshingSchemas = false;
		}
	}

	onMount(async () => {
		await loadSchemas();
	});

	function handleDrop(e) {
		e.preventDefault();
		isDragging = false;
		const dropped = e.dataTransfer?.files?.[0];
		if (dropped) {
			if (!dropped.name.toLowerCase().endsWith('.docx')) {
				errorMessage = 'Only .docx Word documents are supported.';
				return;
			}
			file = dropped;
			errorMessage = '';
		}
	}

	function handleFileSelect(e) {
		const selected = e.currentTarget.files?.[0];
		if (selected) {
			if (!selected.name.toLowerCase().endsWith('.docx')) {
				errorMessage = 'Only .docx Word documents are supported.';
				return;
			}
			file = selected;
			errorMessage = '';
		}
	}

	async function uploadAndParse() {
		if (!file || !selectedContentTypeUid) return;
		uploading = true;
		errorMessage = '';

		const formData = new FormData();
		formData.append('file', file);
		formData.append('contentType', selectedContentTypeUid);

		try {
			const res = await fetch('/api/jobs', {
				method: 'POST',
				body: formData
			});

			const json = await res.json();
			if (!res.ok) {
				throw new Error(json.error?.message || 'Upload failed');
			}

			uploadedJob = json;
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : String(err);
		} finally {
			uploading = false;
		}
	}

	async function startExtraction() {
		if (!uploadedJob?.jobId) return;
		extracting = true;
		errorMessage = '';

		const stages = [
			'Reading document structure & block markers...',
			'Understanding semantics & table hierarchies...',
			`Mapping content onto live Strapi schema "${selectedContentType?.displayName || ''}"...`,
			'Validating field constraints and confidence scores...'
		];

		let stageIndex = 0;
		extractStage = stages[0];
		const interval = setInterval(() => {
			stageIndex = (stageIndex + 1) % stages.length;
			extractStage = stages[stageIndex];
		}, 1200);

		try {
			const res = await fetch(`/api/jobs/${uploadedJob.jobId}/extract`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contentType: selectedContentTypeUid })
			});

			clearInterval(interval);
			const json = await res.json();

			if (!res.ok) {
				throw new Error(json.error?.message || 'Extraction failed');
			}

			// Transition straight to review page
			goto(`/jobs/${uploadedJob.jobId}`);
		} catch (err) {
			clearInterval(interval);
			errorMessage = err instanceof Error ? err.message : String(err);
			extracting = false;
		}
	}
</script>

<!--
	Fonts (Outfit + Inter) are loaded in +layout.svelte.
	Background glow / starfield also come from the layout, so this page stays transparent.
-->
<div class="flex w-full flex-1 text-slate-100">
	<div
		class="mx-auto flex w-full max-w-4xl flex-col justify-center gap-7 px-4 pt-6 pb-12 sm:gap-9 sm:px-6 sm:pt-10 sm:pb-16"
	>
		<!-- Stepper -->
		<div class="mx-auto w-full max-w-2xl">
			<Stepper currentStep={uploadedJob ? 1 : 0} />
		</div>

		<!-- Hero -->
		<header class="flex flex-col items-center gap-4 text-center sm:gap-5">
			<div
				class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 text-xs font-medium text-slate-300 backdrop-blur-md"
			>
				<span
					class="h-1.5 w-1.5 rounded-full bg-violet-400 shadow-[0_0_10px_2px_rgba(167,139,250,0.7)]"
				></span>
				AI-assisted Word to CMS import
			</div>

			<h1
				class="font-['Outfit','Inter',sans-serif] text-[clamp(2rem,6.2vw,3.75rem)] leading-[1.1] font-semibold tracking-tight text-balance"
			>
				<span class="block text-white">DOCX &rarr; Strapi</span>
				<span class="block text-[#9d8dff]">CMS Automation</span>
			</h1>

			{#if !uploadedJob}
				<p class="max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base">
					Extract Word documents, dynamically map content to live Strapi schemas, review
					field-by-field, and publish directly.
				</p>
			{/if}
		</header>

		<!-- Strapi connection -->
		<section
			aria-label="Strapi connection"
			class="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl sm:p-5"
		>
			<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
				<div class="flex min-w-0 flex-col gap-2.5 md:flex-1">
					<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
						<span class="relative flex h-2.5 w-2.5 shrink-0">
							{#if loadingSchemas && !connectionStatus}
								<span
									class="relative inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-violet-400"
								></span>
							{:else if connectionStatus?.success}
								<span
									class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60"
								></span>
								<span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
							{:else}
								<span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500"></span>
							{/if}
						</span>

						<span class="font-['Outfit','Inter',sans-serif] text-base font-semibold text-white">
							Strapi Connection
						</span>

						{#if loadingSchemas && !connectionStatus}
							<span
								class="rounded-full border border-violet-400/30 bg-violet-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-violet-200"
							>
								Connecting...
							</span>
						{:else}
							<span
								class="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold {connectionStatus?.success
									? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
									: 'border-rose-400/30 bg-rose-500/10 text-rose-300'}"
							>
								{connectionStatus?.success ? 'Connected' : 'Disconnected'}
							</span>
						{/if}
					</div>

					<div class="truncate font-mono text-xs text-slate-300" title={strapiUrl}>
						{strapiUrl || (loadingSchemas ? 'Resolving Strapi URL...' : 'Strapi URL not set')}
					</div>

					{#if connectionStatus?.success}
						<div class="flex flex-wrap gap-2 text-[11px] tabular-nums">
							<span
								class="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-slate-400"
							>
								Strapi Version:
								<strong class="font-semibold text-violet-300">{strapiVersion}.x</strong>
							</span>
							<span
								class="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-slate-400"
							>
								Content Types:
								<strong class="font-semibold text-white">{contentTypes.length} discovered</strong>
							</span>
							{#if componentsCount > 0}
								<span
									class="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-slate-400"
								>
									Components:
									<strong class="font-semibold text-white">{componentsCount} discovered</strong>
								</span>
							{/if}
						</div>
					{/if}
				</div>

				<div class="flex flex-col gap-2 sm:flex-row sm:items-center md:shrink-0">
					<button
						type="button"
						disabled={testingConnection}
						class="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-full border border-white/25 px-5 text-xs font-semibold text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
						onclick={testConnection}
					>
						{testingConnection ? 'Testing...' : 'Test Connection'}
					</button>
					<button
						type="button"
						disabled={refreshingSchemas || loadingSchemas}
						class="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[image:linear-gradient(to_bottom,#8f7cf9,#6446e6)] px-5 text-xs font-semibold text-white shadow-[0_10px_28px_-12px_rgba(124,92,255,0.9)] ring-1 ring-white/20 transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none sm:w-auto"
						onclick={() => loadSchemas(true)}
					>
						<svg
							class="h-3.5 w-3.5 {refreshingSchemas ? 'animate-spin' : ''}"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/>
						</svg>
						<span>{refreshingSchemas ? 'Refreshing...' : 'Refresh Strapi Schema'}</span>
					</button>
				</div>
			</div>

			{#if connectionStatus && !connectionStatus.success}
				<div
					class="mt-4 space-y-1.5 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-xs text-rose-200"
					role="alert"
				>
					<div class="font-semibold">{connectionStatus.message || 'Connection failed'}</div>
					{#if connectionStatus.errorCode}
						<div class="font-mono text-[11px] text-rose-300">
							Error Code: <strong>{connectionStatus.errorCode}</strong>
						</div>
					{/if}
					<p class="text-[11px] text-slate-300">
						You can change the Strapi URL or API Token in
						<a
							href="/settings"
							class="font-semibold text-violet-300 underline hover:text-violet-200"
						>
							Settings
						</a>.
					</p>
				</div>
			{/if}
		</section>

		<!-- Error Alert -->
		{#if errorMessage}
			<div
				role="alert"
				class="flex items-start gap-3 rounded-2xl border border-rose-400/35 bg-rose-500/10 p-4 text-sm text-rose-200"
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

		<!-- Workspace "device" frame -->
		<div
			class="rounded-[2rem] bg-[image:linear-gradient(to_bottom,rgba(255,255,255,0.16),rgba(255,255,255,0.03))] p-1.5 shadow-[0_40px_120px_-40px_rgba(124,92,255,0.55)] sm:p-2.5"
		>
			<div
				class="rounded-[1.6rem] border border-white/5 bg-[#070817] p-4 sm:rounded-[1.75rem] sm:p-7"
			>
				{#if !uploadedJob}
					<!-- Upload Form -->
					<div class="space-y-5">
						<div class="space-y-3">
							<label
								for="dropzone-input"
								class="block font-['Outfit','Inter',sans-serif] text-lg font-semibold text-white"
							>
								Upload Word Document (.docx)
							</label>

							<label
								for="dropzone-input"
								class="group flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-4 py-9 text-center transition focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-violet-300 sm:px-6 sm:py-12
									{isDragging
									? 'border-violet-300 bg-violet-500/20'
									: file
										? 'border-violet-400/60 bg-violet-500/10'
										: 'border-white/15 bg-white/[0.02] hover:border-violet-400/60 hover:bg-violet-500/[0.07]'}"
								ondragover={(e) => {
									e.preventDefault();
									isDragging = true;
								}}
								ondragleave={() => (isDragging = false)}
								ondrop={handleDrop}
							>
								<div
									class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.08] text-violet-200 ring-1 ring-white/25 transition duration-300 group-hover:scale-105 group-hover:bg-white/[0.12]"
								>
									{#if file}
										<svg
											class="h-6 w-6"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											stroke-width="1.75"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
											/>
										</svg>
									{:else}
										<svg
											class="h-6 w-6"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											stroke-width="1.75"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
											/>
										</svg>
									{/if}
								</div>

								{#if file}
									<div class="max-w-full font-semibold break-all text-violet-200">{file.name}</div>
									<div class="mt-1 font-mono text-xs text-slate-400 tabular-nums">
										{(file.size / 1024).toFixed(1)} KB
									</div>
									<span class="mt-2 text-xs text-slate-500"
										>Click or drop another file to replace</span
									>
								{:else}
									<div class="max-w-sm text-sm leading-relaxed font-medium text-slate-200">
										Drag and drop your Word document here, or
										<span class="font-semibold text-violet-300 underline underline-offset-4">
											browse
										</span>
									</div>
									<p class="mt-1.5 text-xs text-slate-500">Standard .docx documents up to 10 MB</p>
								{/if}

								<input
									id="dropzone-input"
									type="file"
									accept=".docx"
									class="sr-only"
									onchange={handleFileSelect}
								/>
							</label>
						</div>

						<!-- Submit Button -->
						<button
							type="button"
							disabled={!file || !selectedContentTypeUid || uploading}
							class="inline-flex min-h-13 w-full cursor-pointer items-center justify-center gap-2.5 rounded-full bg-[image:linear-gradient(to_bottom,#8f7cf9,#6446e6)] px-6 text-sm font-semibold text-white shadow-[0_14px_36px_-14px_rgba(124,92,255,0.95)] ring-1 ring-white/20 transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:brightness-100"
							onclick={uploadAndParse}
						>
							{#if uploading}
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
								<span>Parsing Document Structure...</span>
							{:else}
								<span>Upload &amp; Parse Document</span>
							{/if}
						</button>
					</div>
				{:else}
					<!-- Document Parsed Summary -->
					<div class="space-y-5">
						<div
							class="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between"
						>
							<div class="min-w-0 space-y-2">
								<h2
									class="font-['Outfit','Inter',sans-serif] text-xl font-semibold break-words text-white sm:text-2xl"
								>
									{uploadedJob.fileInfo?.name}
								</h2>
								<div class="flex flex-wrap items-center gap-2 text-xs text-slate-400">
									<span>
										Target:
										<span class="font-semibold text-violet-300">
											{selectedContentType?.displayName || uploadedJob.contentType?.displayName}
										</span>
									</span>
									<span
										class="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold {selectedContentType?.kind ===
										'singleType'
											? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
											: 'border-violet-400/30 bg-violet-500/15 text-violet-200'}"
									>
										{selectedContentType?.kind === 'singleType' ? 'Single Type' : 'Collection Type'}
									</span>
									<span class="font-mono">
										SHA-256: {uploadedJob.fileInfo?.sha256?.substring(0, 12)}...
									</span>
								</div>
							</div>

							<button
								type="button"
								class="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/25 px-5 text-xs font-semibold text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
								onclick={() => {
									uploadedJob = null;
									file = null;
								}}
							>
								Choose another file
							</button>
						</div>

						<!-- Target Content Type Selector (Switchable before extraction) -->
						<div class="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
							<div class="flex flex-wrap items-center justify-between gap-2">
								<label
									for="pre-extract-collection"
									class="block text-sm font-semibold text-slate-200"
								>
									Target Strapi Content Type (Change before extraction if needed)
								</label>
								{#if selectedContentType?.draftAndPublish}
									<span
										class="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300"
									>
										Draft Mode Active
									</span>
								{/if}
							</div>

							<div class="relative">
								<select
									id="pre-extract-collection"
									bind:value={selectedContentTypeUid}
									onchange={(e) => onSelectCollection(e.currentTarget.value)}
									class="min-h-12 w-full cursor-pointer appearance-none rounded-2xl border border-white/15 bg-[#0b0c1f] py-3 pr-11 pl-4 text-sm font-medium text-white [color-scheme:dark] transition hover:border-violet-400/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
								>
									{#if collectionTypes.length > 0}
										<optgroup label="Collection Types">
											{#each collectionTypes as ct}
												<option value={ct.uid}>
													{ct.displayName || ct.singularName} &bull; /api/{ct.pluralName ||
														ct.singularName}
												</option>
											{/each}
										</optgroup>
									{/if}
									{#if singleTypes.length > 0}
										<optgroup label="Single Types">
											{#each singleTypes as st}
												<option value={st.uid}>
													{st.displayName || st.singularName} &bull; /api/{st.singularName}
												</option>
											{/each}
										</optgroup>
									{/if}
								</select>
								<svg
									class="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-slate-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
								</svg>
							</div>
						</div>

						<!-- Structural Summary Stats -->
						<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
							<div class="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center">
								<div
									class="bg-[image:linear-gradient(to_bottom,#ffffff,#b5a9ff)] bg-clip-text font-['Outfit','Inter',sans-serif] text-3xl font-semibold text-transparent tabular-nums"
								>
									{uploadedJob.documentSummary?.totalBlocks}
								</div>
								<div class="mt-1 text-xs font-medium text-slate-400">Total Blocks</div>
							</div>
							<div class="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center">
								<div
									class="bg-[image:linear-gradient(to_bottom,#ffffff,#b5a9ff)] bg-clip-text font-['Outfit','Inter',sans-serif] text-3xl font-semibold text-transparent tabular-nums"
								>
									{uploadedJob.documentSummary?.headingCount}
								</div>
								<div class="mt-1 text-xs font-medium text-slate-400">Headings</div>
							</div>
							<div class="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center">
								<div
									class="bg-[image:linear-gradient(to_bottom,#ffffff,#b5a9ff)] bg-clip-text font-['Outfit','Inter',sans-serif] text-3xl font-semibold text-transparent tabular-nums"
								>
									{uploadedJob.documentSummary?.tableCount}
								</div>
								<div class="mt-1 text-xs font-medium text-slate-400">Tables</div>
							</div>
							<div class="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center">
								<div
									class="bg-[image:linear-gradient(to_bottom,#ffffff,#b5a9ff)] bg-clip-text font-['Outfit','Inter',sans-serif] text-3xl font-semibold text-transparent tabular-nums"
								>
									{uploadedJob.documentSummary?.imageCount}
								</div>
								<div class="mt-1 text-xs font-medium text-slate-400">Embedded Images</div>
							</div>
						</div>

						{#if uploadedJob.warnings && uploadedJob.warnings.length > 0}
							<div
								class="space-y-1.5 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-200"
							>
								<div class="font-semibold text-amber-300">Parser Warnings:</div>
								{#each uploadedJob.warnings as w}
									<div>&bull; {w}</div>
								{/each}
							</div>
						{/if}

						{#if extracting}
							<div
								class="space-y-3 rounded-3xl border border-violet-400/25 bg-violet-500/[0.07] p-6 text-center"
								aria-live="polite"
							>
								<div
									class="mx-auto h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10"
									aria-hidden="true"
								>
									<span
										class="sweep block h-full w-2/5 rounded-full bg-[image:linear-gradient(90deg,#8f7cf9,#c4b8ff)]"
									></span>
								</div>
								<div class="font-['Outfit','Inter',sans-serif] text-base font-semibold text-white">
									{extractStage}
								</div>
								<p class="text-xs text-slate-400">
									Applying live Strapi schema constraints and extracting field data
								</p>
							</div>
						{:else}
							<button
								type="button"
								class="group inline-flex min-h-13 w-full cursor-pointer items-center justify-center gap-2.5 rounded-full bg-[image:linear-gradient(to_bottom,#8f7cf9,#6446e6)] px-6 text-sm font-semibold text-white shadow-[0_14px_36px_-14px_rgba(124,92,255,0.95)] ring-1 ring-white/20 transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
								onclick={startExtraction}
							>
								<span>Run AI Extraction</span>
								<svg
									class="h-4 w-4 transition group-hover:translate-x-0.5"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14m-6-6l6 6-6 6" />
								</svg>
							</button>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	/* Tailwind has no built-in indeterminate progress animation */
	.sweep {
		animation: sweep 1.4s ease-in-out infinite;
	}
	@keyframes sweep {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(250%);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.sweep {
			animation: none;
			width: 100%;
		}
	}
</style>
