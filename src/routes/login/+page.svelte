<script>
	let { form } = $props();
	let loading = $state(false);
	let showPassword = $state(false);
</script>

<div
	class="relative flex min-h-screen flex-col justify-center overflow-hidden bg-[#090b10] px-4 py-10 font-sans text-slate-100 sm:px-6 lg:px-8"
>
	<!-- Subtle top ambient light -->
	<div
		aria-hidden="true"
		class="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.14),transparent_70%)]"
	></div>

	<div class="relative mx-auto w-full max-w-md">
		<div class="flex flex-col items-center text-center">
			<div
				class="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-xl font-black text-white shadow-lg ring-1 shadow-indigo-600/25 ring-white/15"
			>
				D
			</div>
			<h1 class="mt-4 text-2xl font-bold tracking-tight text-white">DocuFlow</h1>
			<p class="mt-1.5 text-sm font-medium text-slate-400">
				DOCX &rarr; Strapi CMS Automation Tool
			</p>
		</div>

		<div class="df-card mt-7 p-6 sm:p-8">
			{#if form?.message}
				<div
					class="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-sm text-rose-200"
					role="alert"
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
					<span>{form.message}</span>
				</div>
			{/if}

			<form method="POST" action="?/login" class="space-y-5" onsubmit={() => (loading = true)}>
				<div>
					<label
						for="password"
						class="block text-xs font-semibold tracking-wide text-slate-300 uppercase"
					>
						Application Password
					</label>
					<div class="relative mt-2">
						<input
							id="password"
							name="password"
							type={showPassword ? 'text' : 'password'}
							required
							autocomplete="current-password"
							placeholder="Enter password..."
							class="df-input py-2.5 pr-11 pl-3.5 text-sm"
						/>
						<button
							type="button"
							aria-label={showPassword ? 'Hide password' : 'Show password'}
							class="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
							onclick={() => (showPassword = !showPassword)}
						>
							{#if showPassword}
								<svg
									class="h-4 w-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
									/>
								</svg>
							{:else}
								<svg
									class="h-4 w-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
									/>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
									/>
								</svg>
							{/if}
						</button>
					</div>
					<p class="mt-2.5 text-xs leading-relaxed text-slate-500">
						Protected internal tool. Secrets and API keys are stored securely on the server.
					</p>
				</div>

				<button type="submit" disabled={loading} class="df-btn-primary w-full px-4 py-2.5 text-sm">
					{#if loading}
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
						<span>Authenticating...</span>
					{:else}
						<span>Sign in to DocuFlow</span>
					{/if}
				</button>
			</form>
		</div>
	</div>
</div>
