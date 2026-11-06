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
    let singleTypes = $derived(
        contentTypes.filter((ct) => ct.kind === 'singleType')
    );
 
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
 
<div
    class="home-page mx-auto flex w-full max-w-4xl min-h-0 flex-1 flex-col justify-center gap-3 px-4 py-3 sm:gap-4 sm:py-4"
    class:compact-viewport={!uploadedJob}
>
    <!-- Stepper -->
    <Stepper currentStep={uploadedJob ? 1 : 0} />
 
    <!-- Intro Hero -->
    <div class="space-y-1 text-center">
        <h1 class="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
            DOCX &rarr; Strapi CMS Automation
        </h1>
        {#if !uploadedJob}
            <p class="mx-auto max-w-xl text-sm text-slate-400">
                Extract Word documents, dynamically map content to live Strapi schemas, review field-by-field, and publish directly.
            </p>
        {/if}
    </div>
 
    <!-- Live Strapi Connection Status Card -->
    <div class="rounded-2xl border border-slate-800 bg-slate-900/90 p-3 shadow-xl sm:p-4">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-start gap-3">
                <div class="mt-0.5">
                    {#if connectionStatus?.success}
                        <span class="relative flex h-3 w-3">
                            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                            <span class="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
                        </span>
                    {:else}
                        <span class="inline-flex h-3 w-3 rounded-full bg-rose-500"></span>
                    {/if}
                </div>
                <div class="space-y-1">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-white uppercase tracking-wider">Strapi Connection</span>
                        <span class="rounded px-2 py-0.5 font-mono text-[10px] font-bold {connectionStatus?.success ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-900' : 'bg-rose-950/80 text-rose-400 border border-rose-900'}">
                            {connectionStatus?.success ? '● Connected' : 'Disconnected'}
                        </span>
                    </div>
                    <div class="font-mono text-xs text-slate-300">
                        {strapiUrl || 'Strapi URL not set'}
                    </div>
                    {#if connectionStatus?.success}
                        <div class="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400">
                            <span>Strapi Version: <strong class="text-indigo-400">{strapiVersion}.x</strong></span>
                            <span>&bull;</span>
                            <span>Content Types: <strong class="text-white">{contentTypes.length} discovered</strong></span>
                            {#if componentsCount > 0}
                                <span>&bull;</span>
                                <span>Components: <strong class="text-white">{componentsCount} discovered</strong></span>
                            {/if}
                        </div>
                    {/if}
                </div>
            </div>
 
            <div class="flex items-center gap-2">
                <button
                    type="button"
                    disabled={testingConnection}
                    class="cursor-pointer rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
                    onclick={testConnection}
                >
                    {testingConnection ? 'Testing...' : 'Test Connection'}
                </button>
                <button
                    type="button"
                    disabled={refreshingSchemas || loadingSchemas}
                    class="flex cursor-pointer items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-indigo-500 disabled:opacity-50"
                    onclick={() => loadSchemas(true)}
                >
                    <span class={refreshingSchemas ? 'animate-spin' : ''}>↻</span>
                    <span>{refreshingSchemas ? 'Refreshing...' : 'Refresh Strapi Schema'}</span>
                </button>
            </div>
        </div>
 
        {#if connectionStatus && !connectionStatus.success}
            <div class="mt-4 rounded-xl border border-rose-900/50 bg-rose-950/30 p-3 text-xs text-rose-300 space-y-1">
                <div class="font-bold">{connectionStatus.message || 'Connection failed'}</div>
                {#if connectionStatus.errorCode}
                    <div class="font-mono text-[11px] text-rose-400">
                        Error Code: <strong>{connectionStatus.errorCode}</strong>
                    </div>
                {/if}
                <p class="text-[11px] text-slate-400 pt-1">
                    You can change the Strapi URL or API Token in <a href="/settings" class="text-indigo-400 underline font-semibold">Settings</a>.
                </p>
            </div>
        {/if}
    </div>
 
    <!-- Error Alert -->
    {#if errorMessage}
        <div
            class="flex items-start gap-3 rounded-xl border border-rose-800 bg-rose-950/80 p-4 text-xs text-rose-200 shadow-lg"
        >
            <svg
                class="h-5 w-5 shrink-0 text-rose-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
            </svg>
            <div class="flex-1">{errorMessage}</div>
        </div>
    {/if}
 
    {#if !uploadedJob}
        <!-- Upload Form Card -->
        <div class="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-2xl sm:p-5">
            <!-- Step 2: File Dropzone -->
            <div class="space-y-2">
                <label
                    for="dropzone-input"
                    class="block text-xs font-semibold tracking-wider text-slate-300 uppercase"
                >
                    Upload Word Document (.docx)
                </label>
 
                <label
                    for="dropzone-input"
                    class="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition sm:p-7
                        {isDragging
                        ? 'border-indigo-500 bg-indigo-950/20'
                        : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'}"
                    ondragover={(e) => {
                        e.preventDefault();
                        isDragging = true;
                    }}
                    ondragleave={() => (isDragging = false)}
                    ondrop={handleDrop}
                >
                    <svg
                        class="mb-2 h-10 w-10 text-slate-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="1.5"
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                    </svg>
 
                    {#if file}
                        <div class="text-sm font-semibold text-indigo-400">{file.name}</div>
                        <div class="mt-1 font-mono text-xs text-slate-500">
                            {(file.size / 1024).toFixed(1)} KB
                        </div>
                    {:else}
                        <div class="text-sm font-medium text-slate-300">
                            Drag and drop your Word document here, or <span class="text-indigo-400 underline"
                                >browse</span
                            >
                        </div>
                        <p class="mt-1 text-xs text-slate-500">Standard .docx documents up to 10 MB</p>
                    {/if}
 
                    <input
                        id="dropzone-input"
                        type="file"
                        accept=".docx"
                        class="hidden"
                        onchange={handleFileSelect}
                    />
                </label>
            </div>
 
            <!-- Submit Button -->
            <button
                type="button"
                disabled={!file || !selectedContentTypeUid || uploading}
                class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:opacity-40"
                onclick={uploadAndParse}
            >
                {#if uploading}
                    <svg class="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
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
        <!-- Document Parsed Summary Card (compact so everything fits without scrolling) -->
        <div class="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-2xl sm:p-5">
            <div class="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                    <h3 class="text-base font-bold text-white">{uploadedJob.fileInfo?.name}</h3>
                    <div class="flex items-center gap-2 font-mono text-xs text-slate-400">
                        <span>Target: <span class="text-indigo-400 font-semibold">{selectedContentType?.displayName || uploadedJob.contentType?.displayName}</span></span>
                        <span class="rounded border px-1.5 py-0.5 text-[9px] font-semibold {selectedContentType?.kind === 'singleType' ? 'border-emerald-800 bg-emerald-950/60 text-emerald-400' : 'border-indigo-800 bg-indigo-950/60 text-indigo-400'}">
                            {selectedContentType?.kind === 'singleType' ? 'Single Type' : 'Collection Type'}
                        </span>
                        <span>&bull; SHA-256: {uploadedJob.fileInfo?.sha256?.substring(0, 12)}...</span>
                    </div>
                </div>
                <button
                    type="button"
                    class="text-xs text-slate-400 hover:text-white"
                    onclick={() => {
                        uploadedJob = null;
                        file = null;
                    }}
                >
                    Choose another file
                </button>
            </div>
 
            <!-- Target Content Type Selector (Switchable before extraction) -->
            <div class="space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-3">
                <div class="flex items-center justify-between">
                    <label
                        for="pre-extract-collection"
                        class="block text-xs font-semibold tracking-wider text-slate-300 uppercase"
                    >
                        Target Strapi Content Type (Change before extraction if needed)
                    </label>
                    {#if selectedContentType?.draftAndPublish}
                        <span
                            class="rounded border border-emerald-900 bg-emerald-950/60 px-2 py-0.5 text-[10px] font-medium text-emerald-400"
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
                        class="w-full cursor-pointer appearance-none rounded-lg border border-slate-700 bg-slate-900 py-2 pr-10 pl-3.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                    >
                        {#if collectionTypes.length > 0}
                            <optgroup label="Collection Types" class="bg-slate-900 font-semibold text-indigo-300">
                                {#each collectionTypes as ct}
                                    <option value={ct.uid} class="bg-slate-950 font-normal text-white">
                                        {ct.displayName || ct.singularName} &bull; /api/{ct.pluralName || ct.singularName}
                                    </option>
                                {/each}
                            </optgroup>
                        {/if}
                        {#if singleTypes.length > 0}
                            <optgroup label="Single Types" class="bg-slate-900 font-semibold text-emerald-300">
                                {#each singleTypes as st}
                                    <option value={st.uid} class="bg-slate-950 font-normal text-white">
                                        {st.displayName || st.singularName} &bull; /api/{st.singularName}
                                    </option>
                                {/each}
                            </optgroup>
                        {/if}
                    </select>
                    <svg
                        class="pointer-events-none absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
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
            <div class="grid grid-cols-4 gap-2 sm:gap-3">
                <div class="rounded-xl border border-slate-800 bg-slate-950 p-2 text-center">
                    <div class="text-base font-bold text-white">{uploadedJob.documentSummary?.totalBlocks}</div>
                    <div class="text-[11px] text-slate-500">Total Blocks</div>
                </div>
                <div class="rounded-xl border border-slate-800 bg-slate-950 p-2 text-center">
                    <div class="text-base font-bold text-indigo-400">
                        {uploadedJob.documentSummary?.headingCount}
                    </div>
                    <div class="text-[11px] text-slate-500">Headings</div>
                </div>
                <div class="rounded-xl border border-slate-800 bg-slate-950 p-2 text-center">
                    <div class="text-base font-bold text-emerald-400">
                        {uploadedJob.documentSummary?.tableCount}
                    </div>
                    <div class="text-[11px] text-slate-500">Tables</div>
                </div>
                <div class="rounded-xl border border-slate-800 bg-slate-950 p-2 text-center">
                    <div class="text-base font-bold text-amber-400">
                        {uploadedJob.documentSummary?.imageCount}
                    </div>
                    <div class="text-[11px] text-slate-500">Embedded Images</div>
                </div>
            </div>
 
            {#if uploadedJob.warnings && uploadedJob.warnings.length > 0}
                <div
                    class="space-y-1 rounded-xl border border-amber-900/60 bg-amber-950/30 p-3 text-xs text-amber-300"
                >
                    <div class="font-semibold text-amber-400">Parser Warnings:</div>
                    {#each uploadedJob.warnings as w}
                        <div>&bull; {w}</div>
                    {/each}
                </div>
            {/if}
 
            {#if extracting}
                <div class="space-y-2 rounded-xl border border-indigo-900/60 bg-slate-950 p-4 text-center">
                    <div class="flex items-center justify-center">
                        <svg class="h-6 w-6 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
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
                    </div>
                    <div class="animate-pulse text-sm font-semibold text-white">
                        {extractStage}
                    </div>
                    <p class="text-xs text-slate-500">
                        Applying live Strapi schema constraints and extracting field data
                    </p>
                </div>
            {:else}
                <button
                    type="button"
                    class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
                    onclick={startExtraction}
                >
                    <span>Run AI Extraction &rarr;</span>
                </button>
            {/if}
        </div>
    {/if}
</div>