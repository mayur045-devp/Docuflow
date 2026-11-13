<script>
	let { data } = $props();

	let config = $state(data.config);
	let schemaSource = $state(data.schemaSource);
	let contentTypes = $state(data.contentTypes || []);

	// Dynamic Strapi connection input
	let inputStrapiUrl = $state(data.config?.strapiUrl || '');
	let inputApiToken = $state('');

	let testingConnection = $state(false);
	let savingConnection = $state(false);
	let testResult = $state(null);

	let manualSchemaText = $state('');
	let manualComponentsText = $state('');
	let schemaRegisterStatus = $state('');
	let schemaRegisterError = $state('');

	async function testConnection(shouldSave = false) {
		if (shouldSave) {
			savingConnection = true;
		} else {
			testingConnection = true;
		}
		testResult = null;

		try {
			const payload = {
				strapiUrl: inputStrapiUrl.trim(),
				apiToken: inputApiToken.trim() || undefined,
				save: shouldSave
			};

			const res = await fetch('/api/strapi/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			const json = await res.json();
			testResult = json;

			if (json.version) {
				config.detectedVersion = json.version;
			}

			if (json.success && shouldSave) {
				config.strapiUrl = json.normalizedUrl;
				inputStrapiUrl = json.normalizedUrl;
				config.hasToken = Boolean(inputApiToken.trim() || config.hasToken);
				inputApiToken = ''; // Clear secret from form input

				// Refresh live schema list from newly active Strapi environment
				const refreshRes = await fetch('/api/schema?refresh=true');
				if (refreshRes.ok) {
					const refreshJson = await refreshRes.json();
					contentTypes = Object.values(refreshJson.contentTypes || {});
					schemaSource = refreshJson.source;
				}
			}
		} catch (err) {
			testResult = {
				success: false,
				status: null,
				apiReachable: false,
				authenticated: false,
				schemaDiscoveryAvailable: false,
				errorCode: 'CLIENT_REQUEST_ERROR',
				message: err instanceof Error ? err.message : String(err)
			};
		} finally {
			testingConnection = false;
			savingConnection = false;
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

<div class="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:space-y-8 sm:px-6 sm:py-8">
	<div class="space-y-1">
		<h1 class="text-xl font-bold tracking-tight text-white sm:text-2xl">
			System Settings &amp; Configuration
		</h1>
		<p class="text-xs leading-relaxed text-slate-400 sm:text-sm">
			Manage external Strapi CMS connection, AI provider settings, and live content type schema
			status.
		</p>
	</div>

	<!-- 1. Connection Card -->
	<section class="df-card space-y-5 p-4 sm:p-6">
		<div class="border-b border-slate-800/80 pb-4">
			<h2 class="text-sm font-bold text-white sm:text-base">Strapi CMS Connection</h2>
			<p class="mt-1 text-xs leading-relaxed text-slate-400">
				Supports arbitrary valid Strapi base URLs. The selected Strapi instance is the single source
				of truth.
			</p>
		</div>

		<!-- Active Connection Info -->
		<div class="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3 sm:gap-4">
			<div class="df-card-inset p-3.5">
				<span class="mb-1.5 block text-[11px] font-medium text-slate-400"
					>Active Strapi Base URL</span
				>
				<span class="font-mono font-medium break-all text-white">{config.strapiUrl}</span>
			</div>
			<div class="df-card-inset p-3.5">
				<span class="mb-1.5 block text-[11px] font-medium text-slate-400">Detected Version</span>
				<span class="font-mono font-bold text-indigo-300">Strapi {config.detectedVersion}.x</span>
			</div>
			<div class="df-card-inset p-3.5">
				<span class="mb-1.5 block text-[11px] font-medium text-slate-400">API Token Status</span>
				<span class="font-mono font-bold {config.hasToken ? 'text-emerald-300' : 'text-rose-300'}">
					{config.hasToken ? 'Configured (Server-Side Only)' : 'Missing'}
				</span>
			</div>
		</div>

		<!-- Switch / Test Dynamic Connection Form -->
		<div class="df-card-inset space-y-4 p-4 sm:p-5">
			<div class="space-y-1">
				<h3 class="text-xs font-bold tracking-wider text-white uppercase">
					Connect to a Strapi Environment
				</h3>
				<p class="text-xs leading-relaxed text-slate-400">
					Enter any valid Strapi base URL and optional API token. Trailing slashes are normalized
					automatically.
				</p>
			</div>

			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div>
					<label for="strapi-url-input" class="mb-1.5 block text-xs font-semibold text-slate-300">
						Strapi Base URL
					</label>
					<input
						id="strapi-url-input"
						type="url"
						bind:value={inputStrapiUrl}
						placeholder="https://strapi-preprod.testlifecycle.com"
						class="df-input px-3.5 py-2.5 font-mono text-xs"
					/>
				</div>

				<div>
					<label for="strapi-token-input" class="mb-1.5 block text-xs font-semibold text-slate-300">
						API Token (Leave blank to use currently configured token)
					</label>
					<input
						id="strapi-token-input"
						type="password"
						bind:value={inputApiToken}
						placeholder="Enter token for this environment"
						class="df-input px-3.5 py-2.5 font-mono text-xs"
					/>
				</div>
			</div>

			<div class="flex flex-col gap-2.5 pt-1 sm:flex-row sm:flex-wrap sm:items-center">
				<button
					type="button"
					disabled={testingConnection || savingConnection || !inputStrapiUrl.trim()}
					class="df-btn-secondary w-full px-4 py-2 text-xs sm:w-auto"
					onclick={() => testConnection(false)}
				>
					{testingConnection ? 'Testing...' : 'Test Connection'}
				</button>

				<button
					type="button"
					disabled={testingConnection || savingConnection || !inputStrapiUrl.trim()}
					class="df-btn-primary w-full px-4 py-2 text-xs sm:w-auto"
					onclick={() => testConnection(true)}
				>
					{savingConnection ? 'Saving & Connecting...' : 'Save & Switch Active Connection'}
				</button>
			</div>
		</div>

		<!-- Diagnostic Test Result -->
		{#if testResult}
			<div
				role="status"
				class="space-y-2.5 rounded-xl border p-4 text-xs {testResult.success
					? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
					: 'border-rose-500/35 bg-rose-500/10 text-rose-200'}"
			>
				<div class="flex flex-wrap items-center justify-between gap-2 text-sm font-bold">
					<span
						>{testResult.success ? '✓ Strapi Connection Successful' : '✗ Connection Failed'}</span
					>
					{#if testResult.status}
						<span
							class="rounded-md px-2 py-0.5 font-mono text-[11px] {testResult.success
								? 'bg-emerald-500/20 text-emerald-200'
								: 'bg-rose-500/20 text-rose-200'}"
						>
							HTTP {testResult.status}
						</span>
					{/if}
				</div>

				<p
					class="text-xs leading-relaxed {testResult.success
						? 'text-emerald-200'
						: 'text-rose-200'}"
				>
					{testResult.message}
				</p>

				{#if testResult.errorCode}
					<div class="font-mono text-[11px] text-slate-300">
						Error Code: <strong class="text-rose-300">{testResult.errorCode}</strong>
					</div>
				{/if}

				{#if testResult.normalizedUrl}
					<div class="font-mono text-[11px] break-all text-slate-300">
						Normalized URL: <strong class="text-white">{testResult.normalizedUrl}</strong>
						{#if testResult.durationMs}
							<span class="text-slate-400">({testResult.durationMs}ms)</span>
						{/if}
					</div>
				{/if}

				{#if testResult.success}
					<div
						class="grid grid-cols-1 gap-2 pt-1.5 font-mono text-[11px] text-slate-200 sm:grid-cols-2 md:grid-cols-4"
					>
						<div>Status: <strong class="text-emerald-300">● Connected</strong></div>
						<div>
							Version: <strong class="text-indigo-300">Strapi {testResult.version || '5'}.x</strong>
						</div>
						<div>
							Content Types: <strong class="text-white"
								>{testResult.contentTypesCount || 0} discovered</strong
							>
						</div>
						<div>
							Components: <strong class="text-white"
								>{testResult.componentsCount || 0} discovered</strong
							>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</section>

	<!-- 2. AI Provider Card -->
	<section class="df-card space-y-4 p-4 sm:p-6">
		<h2 class="border-b border-slate-800/80 pb-3 text-sm font-bold text-white sm:text-base">
			AI Engine Configuration
		</h2>
		<div class="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 sm:gap-4">
			<div class="df-card-inset p-3.5">
				<span class="mb-1.5 block text-[11px] font-medium text-slate-400">Active Provider</span>
				<span class="font-mono font-bold text-white uppercase">{config.aiProvider}</span>
			</div>
			<div class="df-card-inset p-3.5">
				<span class="mb-1.5 block text-[11px] font-medium text-slate-400">Model</span>
				<span class="font-mono font-bold break-all text-indigo-300">{config.geminiModel}</span>
			</div>
		</div>
	</section>

	<!-- 3. Discovered Content Types -->
	<section class="df-card space-y-4 p-4 sm:p-6">
		<div
			class="flex flex-col gap-3 border-b border-slate-800/80 pb-4 sm:flex-row sm:items-center sm:justify-between"
		>
			<div class="min-w-0 space-y-1">
				<h2 class="text-sm font-bold text-white sm:text-base">Live Discovered Content Types</h2>
				<p class="text-xs break-all text-slate-400">
					Single Source of Truth:
					<span class="font-mono font-semibold text-emerald-300">{config.strapiUrl}</span>
				</p>
			</div>
			<span
				class="w-fit shrink-0 rounded-full border border-slate-800 bg-[#0b0e14] px-3 py-1 font-mono text-xs text-slate-300 tabular-nums"
			>
				{contentTypes.length} types loaded
			</span>
		</div>

		<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
			{#each contentTypes as ct}
				<div class="df-card-inset space-y-2 p-4 transition hover:border-slate-700/80">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<span class="text-sm font-bold text-white">{ct.displayName}</span>
						<span
							class="rounded-md border px-2 py-0.5 font-mono text-[10px] font-medium {ct.kind ===
							'singleType'
								? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
								: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300'}"
						>
							{ct.kind === 'singleType' ? 'Single Type' : 'Collection Type'} &bull; {ct.singularName}
						</span>
					</div>
					<div class="text-[11px] text-slate-400 tabular-nums">
						{Object.keys(ct.attributes || {}).length} mappable attributes &bull; Draft &amp; Publish:
						<span class="font-medium text-slate-300">{ct.draftAndPublish ? 'Yes' : 'No'}</span>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- 4. Manual Schema Tool -->
	<section class="df-card space-y-4 p-4 sm:p-6">
		<div class="border-b border-slate-800/80 pb-3">
			<h2 class="text-sm font-bold text-white sm:text-base">
				Custom Schema Preview / Registration
			</h2>
			<p class="mt-1 text-xs leading-relaxed text-slate-400">
				Allows registering or testing custom schemas during offline prototyping.
			</p>
		</div>

		{#if schemaRegisterStatus}
			<div
				role="status"
				class="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-3.5 text-xs text-emerald-200"
			>
				{schemaRegisterStatus}
			</div>
		{/if}
		{#if schemaRegisterError}
			<div
				role="alert"
				class="rounded-xl border border-rose-500/35 bg-rose-500/10 p-3.5 text-xs text-rose-200"
			>
				{schemaRegisterError}
			</div>
		{/if}

		<div class="space-y-4 text-xs">
			<div>
				<label for="schema-json" class="mb-1.5 block font-semibold text-slate-300">
					Content Type Schema JSON
				</label>
				<textarea
					id="schema-json"
					bind:value={manualSchemaText}
					rows={5}
					placeholder={`{\n  "info": { "singularName": "product", "displayName": "Product" },\n  "options": { "draftAndPublish": true },\n  "attributes": { "title": { "type": "string", "required": true } }\n}`}
					class="df-input p-3.5 font-mono text-[11px] leading-relaxed"></textarea>
			</div>

			<div>
				<label for="components-json" class="mb-1.5 block font-semibold text-slate-300">
					Components Map JSON (optional)
				</label>
				<textarea
					id="components-json"
					bind:value={manualComponentsText}
					rows={3}
					placeholder={`{ "default.feature": { "attributes": { "title": { "type": "string" } } } }`}
					class="df-input p-3.5 font-mono text-[11px] leading-relaxed"></textarea>
			</div>

			<button
				type="button"
				disabled={!manualSchemaText.trim()}
				class="df-btn-primary w-full px-5 py-2.5 text-xs sm:w-auto"
				onclick={registerManualSchema}
			>
				Register Content Type
			</button>
		</div>
	</section>
</div>
