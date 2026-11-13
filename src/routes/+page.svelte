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

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@600;700;800&family=Inter:wght@400;500;600&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div
	class="flex w-full flex-1 bg-[linear-gradient(180deg,#fde7e8_0%,#ffefe7_50%,#fff7f0_100%)] font-['Inter',ui-sans-serif,system-ui,sans-serif] text-[#141414]"
>
	<div
		class="mx-auto flex w-full max-w-5xl flex-col justify-center gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-12"
	>
		<!-- Stepper (sits on a black pill so it reads on the light theme) -->
		<div
			class="mx-auto w-full max-w-2xl rounded-3xl bg-[#141414] px-4 py-3 shadow-[0_16px_36px_-20px_rgba(20,20,20,0.7)]"
		>
			<Stepper currentStep={uploadedJob ? 1 : 0} />
		</div>

		<!-- Hero -->
		<header class="flex flex-col items-center gap-4 text-center sm:gap-5">
			<div
				class="inline-flex items-center gap-2.5 rounded-full bg-white px-5 py-2 text-xs font-semibold shadow-[0_8px_24px_-14px_rgba(255,111,79,0.6)] sm:text-[13px]"
			>
				<svg class="h-3.5 w-3.5 text-[#ff6f4f]" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" />
				</svg>
				<span>AI-assisted Word to CMS import</span>
				<svg class="h-3.5 w-3.5 text-[#ff6f4f]" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" />
				</svg>
			</div>

			<h1
				class="font-['Inter_Tight','Inter',sans-serif] text-[clamp(1.9rem,6vw,3.5rem)] leading-[1.08] font-extrabold tracking-tight text-balance"
			>
				DOCX &rarr; Strapi CMS Automation
			</h1>

			{#if !uploadedJob}
				<p class="max-w-xl text-sm leading-relaxed text-[#5b5652] sm:text-base">
					Extract Word documents, dynamically map content to live Strapi schemas, review
					field-by-field, and publish directly.
				</p>
			{/if}
		</header>

		<!-- Strapi connection bar -->
		<section
			aria-label="Strapi connection"
			class="rounded-[2rem] bg-[#141414] p-4 text-white shadow-[0_20px_44px_-24px_rgba(20,20,20,0.75)] md:rounded-[2.25rem] md:p-3 md:pl-6"
		>
			<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
				<div class="flex min-w-0 flex-col gap-2.5 md:flex-1">
					<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
						<span class="relative flex h-2.5 w-2.5 shrink-0">
							{#if loadingSchemas && !connectionStatus}
								<span class="relative inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400"
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

						<span class="text-sm font-semibold">Strapi Connection</span>

						{#if loadingSchemas && !connectionStatus}
							<span
								class="rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300"
							>
								Connecting...
							</span>
						{:else}
							<span
								class="rounded-full px-2.5 py-0.5 text-[11px] font-semibold {connectionStatus?.success
									? 'bg-emerald-400/15 text-emerald-300'
									: 'bg-rose-500/15 text-rose-300'}"
							>
								{connectionStatus?.success ? 'Connected' : 'Disconnected'}
							</span>
						{/if}
					</div>

					<div class="truncate font-mono text-xs text-white/70" title={strapiUrl}>
						{strapiUrl || (loadingSchemas ? 'Resolving Strapi URL...' : 'Strapi URL not set')}
					</div>

					{#if connectionStatus?.success}
						<div class="flex flex-wrap gap-2 text-[11px] tabular-nums">
							<span class="rounded-full bg-white/10 px-3 py-1 text-white/70">
								Strapi Version:
								<strong class="font-semibold text-[#ff9a80]">{strapiVersion}.x</strong>
							</span>
							<span class="rounded-full bg-white/10 px-3 py-1 text-white/70">
								Content Types:
								<strong class="font-semibold text-white">{contentTypes.length} discovered</strong>
							</span>
							{#if componentsCount > 0}
								<span class="rounded-full bg-white/10 px-3 py-1 text-white/70">
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
						class="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-full border border-white/20 px-5 text-xs font-semibold text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6f4f] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
						onclick={testConnection}
					>
						{testingConnection ? 'Testing...' : 'Test Connection'}
					</button>
					<button
						type="button"
						disabled={refreshingSchemas || loadingSchemas}
						class="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#ff6f4f] px-5 text-xs font-semibold text-white transition hover:bg-[#ff5a36] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
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
					class="mt-4 space-y-1.5 rounded-2xl bg-rose-500/15 p-4 text-xs text-rose-100"
					role="alert"
				>
					<div class="font-semibold">{connectionStatus.message || 'Connection failed'}</div>
					{#if connectionStatus.errorCode}
						<div class="font-mono text-[11px] text-rose-200">
							Error Code: <strong>{connectionStatus.errorCode}</strong>
						</div>
					{/if}
					<p class="text-[11px] text-white/70">
						You can change the Strapi URL or API Token in
						<a href="/settings" class="font-semibold text-[#ff9a80] underline hover:text-white">
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
				class="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
			>
				<svg
					class="mt-0.5 h-4 w-4 shrink-0 text-rose-500"
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

		{#if !uploadedJob}
			<!-- Upload Form Card -->
			<div
				class="space-y-5 rounded-[2rem] border border-white bg-white/80 p-4 shadow-[0_30px_70px_-40px_rgba(255,111,79,0.55)] backdrop-blur-sm sm:p-7"
			>
				<div class="space-y-3">
					<label
						for="dropzone-input"
						class="block font-['Inter_Tight','Inter',sans-serif] text-base font-bold"
					>
						Upload Word Document (.docx)
					</label>

					<label
						for="dropzone-input"
						class="group flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-4 py-9 text-center transition focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#ff6f4f] sm:px-6 sm:py-12
							{isDragging
							? 'border-[#ff6f4f] bg-[#ffe3d8]'
							: file
								? 'border-[#ff6f4f]/60 bg-[#fff1e8]'
								: 'border-[#e8cfc4] bg-[#fff8f3] hover:border-[#ff6f4f]/70 hover:bg-[#fff1e8]'}"
						ondragover={(e) => {
							e.preventDefault();
							isDragging = true;
						}}
						ondragleave={() => (isDragging = false)}
						ondrop={handleDrop}
					>
						<div
							class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#141414] text-white transition group-hover:scale-105"
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
							<div class="max-w-full font-semibold break-all">{file.name}</div>
							<div class="mt-1 font-mono text-xs text-[#6b6560] tabular-nums">
								{(file.size / 1024).toFixed(1)} KB
							</div>
							<span class="mt-2 text-xs text-[#8a837d]"
								>Click or drop another file to replace</span
							>
						{:else}
							<div class="max-w-sm text-sm leading-relaxed font-medium">
								Drag and drop your Word document here, or
								<span class="font-semibold text-[#ff6f4f] underline underline-offset-4">browse</span>
							</div>
							<p class="mt-1.5 text-xs text-[#8a837d]">Standard .docx documents up to 10 MB</p>
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
					class="group inline-flex min-h-13 w-full cursor-pointer items-center justify-center gap-2.5 rounded-full bg-[#141414] px-6 text-sm font-semibold text-white transition hover:bg-[#2a2a2a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6f4f] disabled:cursor-not-allowed disabled:opacity-40"
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
						<svg
							class="h-4 w-4 transition group-enabled:group-hover:translate-x-0.5 group-enabled:group-hover:-translate-y-0.5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M7 17L17 7M9 7h8v8" />
						</svg>
					{/if}
				</button>
			</div>
		{:else}
			<!-- Document Parsed Summary Card -->
			<div
				class="space-y-5 rounded-[2rem] border border-white bg-white/80 p-4 shadow-[0_30px_70px_-40px_rgba(255,111,79,0.55)] backdrop-blur-sm sm:p-7"
			>
				<div
					class="flex flex-col gap-4 border-b border-[#f0ddd3] pb-5 sm:flex-row sm:items-start sm:justify-between"
				>
					<div class="min-w-0 space-y-2">
						<h2
							class="font-['Inter_Tight','Inter',sans-serif] text-xl font-bold break-words sm:text-2xl"
						>
							{uploadedJob.fileInfo?.name}
						</h2>
						<div class="flex flex-wrap items-center gap-2 text-xs text-[#6b6560]">
							<span>
								Target:
								<span class="font-semibold text-[#e5522f]">
									{selectedContentType?.displayName || uploadedJob.contentType?.displayName}
								</span>
							</span>
							<span
								class="rounded-full px-2.5 py-0.5 text-[11px] font-semibold {selectedContentType?.kind ===
								'singleType'
									? 'bg-emerald-100 text-emerald-700'
									: 'bg-[#ffe3d8] text-[#c2410c]'}"
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
						class="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#fde3c8] px-5 text-xs font-semibold text-[#141414] transition hover:bg-[#fbd5ae] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6f4f]"
						onclick={() => {
							uploadedJob = null;
							file = null;
						}}
					>
						Choose another file
					</button>
				</div>

				<!-- Target Content Type Selector (Switchable before extraction) -->
				<div class="space-y-3 rounded-3xl bg-[#fff4ec] p-4 sm:p-5">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<label
							for="pre-extract-collection"
							class="block text-sm font-semibold"
						>
							Target Strapi Content Type (Change before extraction if needed)
						</label>
						{#if selectedContentType?.draftAndPublish}
							<span
								class="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700"
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
							class="min-h-12 w-full cursor-pointer appearance-none rounded-2xl border border-[#ecd5c9] bg-white py-3 pr-11 pl-4 text-sm font-medium text-[#141414] transition hover:border-[#ff6f4f]/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6f4f]"
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
							class="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-[#6b6560]"
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
					<div class="rounded-3xl bg-[#ffe3d8] p-4 text-center">
						<div
							class="font-['Inter_Tight','Inter',sans-serif] text-3xl font-extrabold tabular-nums"
						>
							{uploadedJob.documentSummary?.totalBlocks}
						</div>
						<div class="mt-1 text-xs font-medium text-[#6b6560]">Total Blocks</div>
					</div>
					<div class="rounded-3xl bg-[#ffdfe9] p-4 text-center">
						<div
							class="font-['Inter_Tight','Inter',sans-serif] text-3xl font-extrabold tabular-nums"
						>
							{uploadedJob.documentSummary?.headingCount}
						</div>
						<div class="mt-1 text-xs font-medium text-[#6b6560]">Headings</div>
					</div>
					<div class="rounded-3xl bg-[#dff3e4] p-4 text-center">
						<div
							class="font-['Inter_Tight','Inter',sans-serif] text-3xl font-extrabold tabular-nums"
						>
							{uploadedJob.documentSummary?.tableCount}
						</div>
						<div class="mt-1 text-xs font-medium text-[#6b6560]">Tables</div>
					</div>
					<div class="rounded-3xl bg-[#fff0c4] p-4 text-center">
						<div
							class="font-['Inter_Tight','Inter',sans-serif] text-3xl font-extrabold tabular-nums"
						>
							{uploadedJob.documentSummary?.imageCount}
						</div>
						<div class="mt-1 text-xs font-medium text-[#6b6560]">Embedded Images</div>
					</div>
				</div>

				{#if uploadedJob.warnings && uploadedJob.warnings.length > 0}
					<div class="space-y-1.5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
						<div class="font-semibold">Parser Warnings:</div>
						{#each uploadedJob.warnings as w}
							<div>&bull; {w}</div>
						{/each}
					</div>
				{/if}

				{#if extracting}
					<div
						class="space-y-3 rounded-3xl bg-[#fff1e8] p-6 text-center"
						aria-live="polite"
					>
						<div
							class="mx-auto h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-[#141414]/10"
							aria-hidden="true"
						>
							<span class="sweep block h-full w-2/5 rounded-full bg-[#ff6f4f]"></span>
						</div>
						<div class="font-['Inter_Tight','Inter',sans-serif] text-base font-bold">
							{extractStage}
						</div>
						<p class="text-xs text-[#6b6560]">
							Applying live Strapi schema constraints and extracting field data
						</p>
					</div>
				{:else}
					<button
						type="button"
						class="group inline-flex min-h-13 w-full cursor-pointer items-center justify-center gap-2.5 rounded-full bg-[#141414] px-6 text-sm font-semibold text-white transition hover:bg-[#2a2a2a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6f4f]"
						onclick={startExtraction}
					>
						<span>Run AI Extraction</span>
						<svg
							class="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M7 17L17 7M9 7h8v8" />
						</svg>
					</button>
				{/if}
			</div>
		{/if}
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