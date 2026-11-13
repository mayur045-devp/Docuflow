<script>
	import './layout.css';
	import { page } from '$app/state';

	let { data, children } = $props();

	let currentPath = $derived(page.url.pathname);
	let isLoginPage = $derived(currentPath === '/login');
	let mobileMenuOpen = $state(false);

	function closeMobileMenu() {
		mobileMenuOpen = false;
	}
</script>

<div
	class="flex min-h-screen flex-col bg-[#07080f] font-sans text-slate-100 selection:bg-violet-600 selection:text-white"
>
	{#if !isLoginPage}
		<!-- Header / Nav -->
		<header
			class="sticky top-0 z-30 shrink-0 border-b border-white/10 bg-[#07080f]/80 bg-[image:radial-gradient(55%_200%_at_50%_-60%,rgba(139,92,246,0.65),transparent_70%),linear-gradient(90deg,rgba(255,255,255,0.06),transparent_22%,transparent_78%,rgba(0,0,0,0.35))] backdrop-blur-xl"
		>
			<div
				class="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 md:grid md:grid-cols-[1fr_auto_1fr] lg:px-0"
			>
				<!-- Brand (left) -->
				<a
					href="/"
					onclick={closeMobileMenu}
					class="group flex shrink-0 items-center gap-2.5 justify-self-start rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-300"
				>
					<div
						class="flex h-10 w-10 items-center justify-center rounded-full bg-[image:linear-gradient(135deg,#a78bfa,#6d4af0)] text-base font-extrabold text-white shadow-lg ring-1 shadow-violet-500/40 ring-white/25 transition duration-300 group-hover:scale-105 group-hover:shadow-violet-400/60"
					>
						D
					</div>
					<span
						class="text-lg font-semibold tracking-tight text-white transition group-hover:text-violet-200"
					>
						DocuFlow
					</span>
				</a>

				<!-- Primary Navigation (center, glass pill) -->
				<nav
					aria-label="Main navigation"
					class="flex hidden w-[550px] items-center justify-center gap-1 rounded-full border border-white/10 bg-white/[0.07] p-1.5 text-[13px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_30px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl md:flex"
				>
					<a
						href="/"
						aria-current={currentPath === '/' ? 'page' : undefined}
						class="inline-flex items-center gap-2 rounded-xl px-4 py-2 transition duration-200
							{currentPath === '/'
							? 'bg-white/15 font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] ring-1 ring-white/20'
							: 'text-slate-300 hover:bg-white/10 hover:text-white'}"
					>
						<svg
							class="h-3.5 w-3.5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
						</svg>
						<span>New Import</span>
					</a>
					<a
						href="/history"
						aria-current={currentPath.startsWith('/history') ? 'page' : undefined}
						class="inline-flex items-center gap-2 rounded-xl px-4 py-2 transition duration-200
							{currentPath.startsWith('/history')
							? 'bg-white/15 font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] ring-1 ring-white/20'
							: 'text-slate-300 hover:bg-white/10 hover:text-white'}"
					>
						<svg
							class="h-3.5 w-3.5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<span>History</span>
					</a>
					<a
						href="/settings"
						aria-current={currentPath.startsWith('/settings') ? 'page' : undefined}
						class="inline-flex items-center gap-2 rounded-xl px-4 py-2 transition duration-200
							{currentPath.startsWith('/settings')
							? 'bg-white/15 font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] ring-1 ring-white/20'
							: 'text-slate-300 hover:bg-white/10 hover:text-white'}"
					>
						<svg
							class="h-3.5 w-3.5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
							/>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
							/>
						</svg>
						<span>Settings</span>
					</a>
				</nav>

				<!-- Right: Strapi connection + mobile menu button -->
				<div class="flex shrink-0 items-center gap-2.5 justify-self-end text-xs">
					{#if data?.strapiUrl}
						<div
							class=" hidden items-center gap-2 rounded-full px-4 py-2.5 text-[12px] shadow-lg ring-1 shadow-violet-600/30 ring-white/10 sm:flex"
							title={`Connected to ${data.strapiUrl}`}
						>
							<span class="relative flex h-2 w-2 shrink-0">
								<span
									class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75"
								></span>
								<span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-300"></span>
							</span>
							<span class="text-green-500">Strapi:</span>
							<span
								class="max-w-[90px] truncate font-mono font-medium text-green-500 lg:max-w-[200px] xl:max-w-[260px]"
							>
								{data.strapiUrl.replace(/^https?:\/\//, '')}
							</span>
						</div>
					{/if}

					<!-- Mobile menu button -->
					<button
						type="button"
						aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
						aria-expanded={mobileMenuOpen}
						aria-controls="mobile-nav-drawer"
						class="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-white/15 bg-white/[0.08] text-slate-200 backdrop-blur-md transition hover:bg-white/15 hover:text-white md:hidden"
						onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
					>
						{#if mobileMenuOpen}
							<svg
								class="h-5 w-5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						{:else}
							<svg
								class="h-5 w-5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
							</svg>
						{/if}
					</button>
				</div>
			</div>

			<!-- Mobile Navigation Panel -->
			{#if mobileMenuOpen}
				<div
					id="mobile-nav-drawer"
					class="border-t border-white/10 bg-[#0b0d18]/90 px-4 py-3 backdrop-blur-xl md:hidden"
				>
					<nav aria-label="Mobile navigation" class="flex flex-col gap-1 text-sm font-medium">
						<a
							href="/"
							onclick={closeMobileMenu}
							aria-current={currentPath === '/' ? 'page' : undefined}
							class="flex items-center gap-2.5 rounded-xl px-3 py-3 transition
								{currentPath === '/'
								? 'bg-white/15 font-semibold text-white ring-1 ring-white/20'
								: 'text-slate-300 hover:bg-white/10 hover:text-white'}"
						>
							<svg
								class="h-4 w-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
							</svg>
							<span>New Import</span>
						</a>
						<a
							href="/history"
							onclick={closeMobileMenu}
							aria-current={currentPath.startsWith('/history') ? 'page' : undefined}
							class="flex items-center gap-2.5 rounded-xl px-3 py-3 transition
								{currentPath.startsWith('/history')
								? 'bg-white/15 font-semibold text-white ring-1 ring-white/20'
								: 'text-slate-300 hover:bg-white/10 hover:text-white'}"
						>
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
									d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							<span>History</span>
						</a>
						<a
							href="/settings"
							onclick={closeMobileMenu}
							aria-current={currentPath.startsWith('/settings') ? 'page' : undefined}
							class="flex items-center gap-2.5 rounded-xl px-3 py-3 transition
								{currentPath.startsWith('/settings')
								? 'bg-white/15 font-semibold text-white ring-1 ring-white/20'
								: 'text-slate-300 hover:bg-white/10 hover:text-white'}"
						>
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
									d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
								/>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
								/>
							</svg>
							<span>Settings</span>
						</a>

						{#if data?.strapiUrl}
							<div
								class="mt-2 flex items-center gap-2 rounded-xl border border-white/20 bg-[image:linear-gradient(to_bottom,#8b5cf6,#5b3bd6)] px-3 py-2.5 text-xs"
							>
								<span class="h-2 w-2 shrink-0 rounded-full bg-emerald-300"></span>
								<span class="text-violet-100/80">Strapi:</span>
								<span class="truncate font-mono text-white">
									{data.strapiUrl.replace(/^https?:\/\//, '')}
								</span>
							</div>
						{/if}

						<form method="POST" action="/login?/logout" class="mt-2 border-t border-white/10 pt-2">
							<button
								type="submit"
								class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300"
							>
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
										d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
									/>
								</svg>
								<span>Logout</span>
							</button>
						</form>
					</nav>
				</div>
			{/if}
		</header>
	{/if}

	<!-- Main Body -->
	<main class="flex min-h-0 flex-1 flex-col">
		{@render children()}
	</main>
</div>
