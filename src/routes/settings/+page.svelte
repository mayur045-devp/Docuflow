<script>
	let { data } = $props();

	let config = $state(data.config);
	let schemaSource = $state(data.schemaSource);
	let contentTypes = $state(data.contentTypes || []);

	let testingConnection = $state(false);
	let testResult = $state(null);

	let manualSchemaText = $state('');
	let manualComponentsText = $state('');
	let schemaRegisterStatus = $state('');
	let schemaRegisterError = $state('');

	async function testConnection() {
		testingConnection = true;
		testResult = null;

		try {
			const res = await fetch('/api/strapi/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({})
			});

			const json = await res.json();
			testResult = json;
			if (json.version) {
				config.detectedVersion = json.version;
			}
			if (json.reachable) {
				const refreshRes = await fetch('/api/schema?refresh=true');
				if (refreshRes.ok) {
					const refreshJson = await refreshRes.json();
					contentTypes = Object.values(refreshJson.contentTypes || {});
					schemaSource = refreshJson.source;
				}
			}
		} catch (err) {
			testResult = {
				reachable: false,
				error: err instanceof Error ? err.message : String(err)
			};
		} finally {
			testingConnection = false;
		}
	}

	async function registerManualSchema() {
		schemaRegisterStatus = '';
		schemaRegisterError = '';

		try {
			const parsedSchema = JSON.parse(manualSchemaText);
			let parsedComponents = {};
			if (manualComponentsText.trim()) {
				parsedComponents = JSON.parse(manualComponentsText);
			}

			const res = await fetch('/api/schema', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ schema: parsedSchema, components: parsedComponents })
			});

			const json = await res.json();
			if (!res.ok) throw new Error(json.error?.message || 'Failed to register schema');

			schemaRegisterStatus = `Registered content type "${json.contentType?.displayName || json.contentType?.singularName}" successfully!`;
			// Refresh list
			const refreshRes = await fetch('/api/schema');
			if (refreshRes.ok) {
				const refreshJson = await refreshRes.json();
				contentTypes = Object.values(refreshJson.contentTypes || {});
				schemaSource = refreshJson.source;
			}
		} catch (err) {
			schemaRegisterError = err instanceof Error ? err.message : 'Invalid JSON format';
		}
	}
</script>

<div class="mx-auto max-w-5xl space-y-8 px-4 py-8">
	<div>
		<h1 class="text-2xl font-bold tracking-tight text-white">System Settings &amp; Configuration</h1>
		<p class="mt-1 text-xs text-slate-400">
			Manage Pre-Production Strapi CMS connection, AI provider settings, and live content type schema status.
		</p>
	</div>

	<!-- 1. Connection Card -->
	<div class="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
		<div class="flex items-center justify-between border-b border-slate-800 pb-4">
			<div>
				<h3 class="text-sm font-bold text-white">Strapi CMS Connection</h3>
				<p class="mt-0.5 text-xs text-slate-400">Authenticated server-to-server REST communication with Pre-Production Strapi.</p>
			</div>
			<button
				type="button"
				disabled={testingConnection}
				class="flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-indigo-500 disabled:opacity-50"
				onclick={testConnection}
			>
				{#if testingConnection}
					<svg class="h-3.5 w-3.5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
						></path>
					</svg>
					<span>Testing...</span>
				{:else}
					<span>Test Strapi Connection</span>
				{/if}
			</button>
		</div>

		<div class="grid grid-cols-1 gap-4 text-xs sm:grid-cols-3">
			<div class="rounded-xl border border-slate-800 bg-slate-950 p-3">
				<span class="mb-1 block text-slate-500">Strapi URL (Pre-Production)</span>
				<span class="font-mono font-medium text-white break-all">{config.strapiUrl}</span>
			</div>
			<div class="rounded-xl border border-slate-800 bg-slate-950 p-3">
				<span class="mb-1 block text-slate-500">Detected Version</span>
				<span class="font-mono font-bold text-indigo-400">Strapi {config.detectedVersion}.x</span>
			</div>
			<div class="rounded-xl border border-slate-800 bg-slate-950 p-3">
				<span class="mb-1 block text-slate-500">API Token</span>
				<span class="font-mono {config.hasToken ? 'text-emerald-400' : 'text-rose-400'} font-bold">
					{config.hasToken ? 'Configured (Server-Side Only)' : 'Missing'}
				</span>
			</div>
		</div>

		{#if testResult}
			<div
				class="rounded-xl border p-4 text-xs {testResult.reachable
					? 'border-emerald-800 bg-emerald-950/30 text-emerald-300'
					: 'border-rose-800 bg-rose-950/30 text-rose-300'} space-y-2"
			>
				<div class="flex items-center gap-2 font-bold text-sm">
					<span>{testResult.reachable ? '✓ Strapi Instance Reachable & Authenticated' : '✗ Connection Failed'}</span>
				</div>
				{#if testResult.error}
					<p class="font-mono text-xs text-rose-300">{testResult.error}</p>
				{/if}
				{#if testResult.possibleCauses}
					<div class="pt-1">
						<span class="font-semibold text-rose-300">Possible causes:</span>
						<ul class="list-inside list-disc space-y-0.5 text-[11px] text-rose-400">
							{#each testResult.possibleCauses as cause}
								<li>{cause}</li>
							{/each}
						</ul>
					</div>
				{/if}
				{#if testResult.reachable}
					<div class="grid grid-cols-2 gap-2 pt-1 text-slate-300 sm:grid-cols-4 font-mono text-[11px]">
						<div>Status: <strong class="text-emerald-400">● Connected</strong></div>
						<div>Version: <strong class="text-indigo-400">Strapi {testResult.version}.x</strong></div>
						<div>Content Types: <strong class="text-white">{testResult.contentTypesCount} discovered</strong></div>
						<div>Components: <strong class="text-white">{testResult.componentsCount} discovered</strong></div>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- 2. AI Provider Card -->
	<div class="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
		<h3 class="border-b border-slate-800 pb-3 text-sm font-bold text-white">
			AI Engine Configuration
		</h3>
		<div class="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
			<div class="rounded-xl border border-slate-800 bg-slate-950 p-3">
				<span class="mb-1 block text-slate-500">Active Provider</span>
				<span class="font-mono font-bold text-white uppercase">{config.aiProvider}</span>
			</div>
			<div class="rounded-xl border border-slate-800 bg-slate-950 p-3">
				<span class="mb-1 block text-slate-500">Model</span>
				<span class="font-mono font-bold text-indigo-400">{config.geminiModel}</span>
			</div>
		</div>
	</div>

	<!-- 3. Discovered Content Types -->
	<div class="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
		<div class="flex items-center justify-between border-b border-slate-800 pb-3">
			<div>
				<h3 class="text-sm font-bold text-white">Live Discovered Content Types</h3>
				<p class="mt-0.5 text-xs text-slate-400">
					Single Source of Truth: <span class="font-mono font-bold text-emerald-400">{config.strapiUrl}</span>
				</p>
			</div>
			<span
				class="rounded-full border border-slate-800 bg-slate-950 px-2.5 py-1 font-mono text-xs text-slate-400"
			>
				{contentTypes.length} types loaded
			</span>
		</div>

		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
			{#each contentTypes as ct}
				<div class="space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-4">
					<div class="flex items-center justify-between">
						<span class="text-sm font-bold text-white">{ct.displayName}</span>
						<span
							class="rounded border px-2 py-0.5 font-mono text-[10px] {ct.kind === 'singleType' ? 'border-emerald-900 bg-emerald-950/60 text-emerald-400' : 'border-indigo-900/60 bg-indigo-950/60 text-indigo-400'}"
						>
							{ct.kind === 'singleType' ? 'Single Type' : 'Collection Type'} &bull; {ct.singularName}
						</span>
					</div>
					<div class="text-[11px] text-slate-400">
						{Object.keys(ct.attributes || {}).length} mappable attributes &bull; Draft &amp; Publish:
						{ct.draftAndPublish ? 'Yes' : 'No'}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- 4. Manual Schema Tool -->
	<div class="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
		<div>
			<h3 class="text-sm font-bold text-white">Custom Schema Preview / Registration</h3>
			<p class="mt-0.5 text-xs text-slate-400">
				Allows registering or testing custom schemas during offline prototyping.
			</p>
		</div>

		{#if schemaRegisterStatus}
			<div
				class="rounded-xl border border-emerald-800 bg-emerald-950/40 p-3 text-xs text-emerald-300"
			>
				{schemaRegisterStatus}
			</div>
		{/if}
		{#if schemaRegisterError}
			<div class="rounded-xl border border-rose-800 bg-rose-950/40 p-3 text-xs text-rose-300">
				{schemaRegisterError}
			</div>
		{/if}

		<div class="space-y-3 text-xs">
			<div>
				<label for="schema-json" class="mb-1 block font-semibold text-slate-300">
					Content Type Schema JSON
				</label>
				<textarea
					id="schema-json"
					bind:value={manualSchemaText}
					rows={5}
					placeholder={`{\n  "info": { "singularName": "product", "displayName": "Product" },\n  "options": { "draftAndPublish": true },\n  "attributes": { "title": { "type": "string", "required": true } }\n}`}
					class="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-[11px] text-slate-200 focus:border-indigo-500 focus:outline-none"
				></textarea>
			</div>

			<div>
				<label for="components-json" class="mb-1 block font-semibold text-slate-300">
					Components Map JSON (optional)
				</label>
				<textarea
					id="components-json"
					bind:value={manualComponentsText}
					rows={3}
					placeholder={`{ "default.feature": { "attributes": { "title": { "type": "string" } } } }`}
					class="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-[11px] text-slate-200 focus:border-indigo-500 focus:outline-none"
				></textarea>
			</div>

			<button
				type="button"
				disabled={!manualSchemaText.trim()}
				class="cursor-pointer rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow transition hover:bg-indigo-500 disabled:opacity-40"
				onclick={registerManualSchema}
			>
				Register Content Type
			</button>
		</div>
	</div>
</div>
