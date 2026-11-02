<script>
	let { form } = $props();
	let loading = $state(false);
</script>

<div
	class="flex min-h-screen flex-col justify-center bg-slate-950 py-12 font-sans text-slate-100 sm:px-6 lg:px-8"
>
	<div class="sm:mx-auto sm:w-full sm:max-w-md">
		<div class="flex items-center justify-center space-x-3">
			<div
				class="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white shadow-lg shadow-indigo-500/30"
			>
				D
			</div>
			<span class="text-2xl font-bold tracking-tight text-white">DocuFlow</span>
		</div>
		<h2 class="mt-4 text-center text-xl font-medium text-slate-400">
			DOCX &rarr; Strapi CMS Automation Tool
		</h2>
	</div>

	<div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
		<div class="rounded-2xl border border-slate-800 bg-slate-900 px-6 py-8 shadow-2xl sm:px-10">
			{#if form?.message}
				<div
					class="mb-5 rounded-lg border border-red-800/80 bg-red-950/80 p-3.5 text-sm text-red-200"
					role="alert"
				>
					{form.message}
				</div>
			{/if}

			<form method="POST" action="?/login" class="space-y-5" onsubmit={() => (loading = true)}>
				<div>
					<label for="password" class="block text-sm font-medium text-slate-300">
						Application Password
					</label>
					<div class="mt-1.5">
						<input
							id="password"
							name="password"
							type="password"
							required
							autocomplete="current-password"
							placeholder="Enter password..."
							class="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
						/>
					</div>
					<p class="mt-2 text-xs text-slate-500">
						Protected internal tool. Secrets and API keys are stored securely on the server.
					</p>
				</div>

				<div>
					<button
						type="submit"
						disabled={loading}
						class="flex w-full cursor-pointer justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
					>
						{loading ? 'Authenticating...' : 'Sign in to DocuFlow'}
					</button>
				</div>
			</form>
		</div>
	</div>
</div>
