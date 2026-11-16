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

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&family=Inter:wght@400;500;600&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div
	class="relative isolate flex min-h-screen flex-col overflow-x-clip bg-[#05050f] font-['Inter',ui-sans-serif,system-ui,sans-serif] text-slate-100 selection:bg-violet-500 selection:text-white"
>
	<!-- Ambient background: violet halo, soft light beam, faint starfield -->
	<div aria-hidden="true" class="pointer-events-none absolute inset-0 -z-10">
		<div
			class="absolute inset-x-0 top-0 h-[36rem] bg-[image:radial-gradient(48%_72%_at_50%_0%,rgba(139,92,246,0.62),rgba(99,71,232,0.2)_46%,transparent_76%)]"
		></div>
		<div
			class="absolute top-0 -left-16 h-96 w-44 -rotate-[28deg] bg-[image:linear-gradient(to_bottom,rgba(255,255,255,0.13),transparent)] blur-2xl"
		></div>
		<div class="stars absolute inset-x-0 top-0 h-[44rem] opacity-70"></div>
	</div>

	{#if !isLoginPage}
		<!-- Header / Nav -->
		<header class="sticky top-0 z-30 shrink-0 px-3 pt-3 pb-2 sm:px-6 sm:pt-4">
			<!-- Soft blurred backdrop that fades out at the bottom edge -->
			<div
				aria-hidden="true"
				class="absolute inset-0 -z-10 bg-[#05050f]/25 [mask-image:linear-gradient(to_bottom,black_70%,transparent)] backdrop-blur-md"
			></div>

			<div
				class="mx-auto flex h-12 max-w-6xl items-center justify-between gap-3 md:grid md:grid-cols-[1fr_auto_1fr]"
			>
				<!-- Brand (left) -->
				<a
					href="/"
					onclick={closeMobileMenu}
					class="group flex shrink-0 items-center gap-2.5 justify-self-start rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-300"
				>
					<div
						class="flex h-9 w-9 items-center justify-center rounded-full bg-[image:linear-gradient(135deg,#a594ff,#6b4df0)] shadow-[0_6px_20px_-6px_rgba(124,92,255,0.9)] ring-1 ring-white/25 transition duration-300 group-hover:scale-105"
					>
						<svg class="h-[18px] w-[18px] text-white" viewBox="0 0 24 24" fill="currentColor">
							<path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" />
						</svg>
					</div>
					<span
						class="font-['Outfit','Inter',sans-serif] text-lg font-semibold tracking-tight text-white"
					>
						DocuFlow
					</span>
				</a>

				<!-- Primary Navigation (center, glass pill) -->
				<nav
					aria-label="Main navigation"
					class="hidden items-center gap-0.5 rounded-2xl border border-white/10 bg-white/[0.06] p-1 text-[13px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl md:flex"
				>
					<a
						href="/"
						aria-current={currentPath === '/' ? 'page' : undefined}
						class="inline-flex items-center gap-2 rounded-xl px-4 py-2 transition duration-200 focus-visible:outline-2 focus-visible:outline-violet-300
							{currentPath === '/'
							? 'bg-violet-500/25 font-semibold text-white ring-1 ring-violet-300/30'
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
						class="inline-flex items-center gap-2 rounded-xl px-4 py-2 transition duration-200 focus-visible:outline-2 focus-visible:outline-violet-300
							{currentPath.startsWith('/history')
							? 'bg-violet-500/25 font-semibold text-white ring-1 ring-violet-300/30'
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
						class="inline-flex items-center gap-2 rounded-xl px-4 py-2 transition duration-200 focus-visible:outline-2 focus-visible:outline-violet-300
							{currentPath.startsWith('/settings')
							? 'bg-violet-500/25 font-semibold text-white ring-1 ring-violet-300/30'
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
				<div class="flex shrink-0 items-center gap-2 justify-self-end text-xs">
					{#if data?.strapiUrl}
						<div
							class="hidden items-center gap-2 rounded-full bg-[image:linear-gradient(to_bottom,#8f7cf9,#6446e6)] px-4 py-2.5 text-[12px] shadow-[0_10px_30px_-12px_rgba(124,92,255,0.9)] ring-1 ring-white/20 sm:flex"
							title={`Connected to ${data.strapiUrl}`}
						>
							<span class="relative flex h-2 w-2 shrink-0">
								<span
									class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75"
								></span>
								<span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-300"></span>
							</span>
							<span class="text-violet-100/80">Strapi:</span>
							<span
								class="max-w-[90px] truncate font-mono font-medium text-white lg:max-w-[200px] xl:max-w-[260px]"
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
						class="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-white/[0.07] text-slate-200 backdrop-blur-md transition hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-300 md:hidden"
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
					class="mx-auto mt-3 max-w-6xl rounded-3xl border border-white/10 bg-[#0b0b1d]/90 p-3 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl md:hidden"
				>
					<nav aria-label="Mobile navigation" class="flex flex-col gap-1 text-sm font-medium">
						<a
							href="/"
							onclick={closeMobileMenu}
							aria-current={currentPath === '/' ? 'page' : undefined}
							class="flex items-center gap-2.5 rounded-2xl px-4 py-3 transition
								{currentPath === '/'
								? 'bg-violet-500/25 font-semibold text-white ring-1 ring-violet-300/30'
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
							class="flex items-center gap-2.5 rounded-2xl px-4 py-3 transition
								{currentPath.startsWith('/history')
								? 'bg-violet-500/25 font-semibold text-white ring-1 ring-violet-300/30'
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
							class="flex items-center gap-2.5 rounded-2xl px-4 py-3 transition
								{currentPath.startsWith('/settings')
								? 'bg-violet-500/25 font-semibold text-white ring-1 ring-violet-300/30'
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
								class="mt-2 flex items-center gap-2 rounded-full bg-[image:linear-gradient(to_bottom,#8f7cf9,#6446e6)] px-4 py-2.5 text-xs ring-1 ring-white/20"
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
								class="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:border-rose-400/50 hover:bg-rose-500/10 hover:text-rose-300"
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

<style>
	/* Faint starfield: tiny dots can't be expressed cleanly with utilities */
	.stars {
		background-image:
			radial-gradient(1px 1px at 8% 22%, rgba(255, 255, 255, 0.9), transparent),
			radial-gradient(1px 1px at 17% 58%, rgba(255, 255, 255, 0.6), transparent),
			radial-gradient(1.5px 1.5px at 26% 12%, rgba(255, 255, 255, 0.8), transparent),
			radial-gradient(1px 1px at 34% 70%, rgba(255, 255, 255, 0.5), transparent),
			radial-gradient(1px 1px at 43% 34%, rgba(255, 255, 255, 0.7), transparent),
			radial-gradient(1.5px 1.5px at 57% 8%, rgba(255, 255, 255, 0.8), transparent),
			radial-gradient(1px 1px at 63% 52%, rgba(255, 255, 255, 0.6), transparent),
			radial-gradient(1px 1px at 72% 24%, rgba(255, 255, 255, 0.9), transparent),
			radial-gradient(1.5px 1.5px at 81% 64%, rgba(255, 255, 255, 0.5), transparent),
			radial-gradient(1px 1px at 90% 18%, rgba(255, 255, 255, 0.8), transparent),
			radial-gradient(1px 1px at 95% 46%, rgba(255, 255, 255, 0.6), transparent);
		-webkit-mask-image: linear-gradient(to bottom, black, transparent 80%);
		mask-image: linear-gradient(to bottom, black, transparent 80%);
	}
</style>
