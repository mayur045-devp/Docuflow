<script>
    import './layout.css';
    import { page } from '$app/state';
 
    let { data, children } = $props();
 
    let currentPath = $derived(page.url.pathname);
    let isLoginPage = $derived(currentPath === '/login');
</script>
 
<div
    class="flex min-h-screen flex-col bg-slate-950 font-sans text-slate-100 selection:bg-indigo-600 selection:text-white"
    class:home-shell={currentPath === '/'}
>
    {#if !isLoginPage}
        <!-- Header / Nav -->
        <header class="sticky top-0 z-30 shrink-0 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
            <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <!-- Brand -->
                <div class="flex items-center space-x-6">
                    <a href="/" class="group flex items-center space-x-2.5">
                        <div
                            class="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-base font-black text-white shadow shadow-indigo-500/20 transition group-hover:bg-indigo-500"
                        >
                            D
                        </div>
                        <span
                            class="text-lg font-bold tracking-tight text-white transition group-hover:text-indigo-200"
                        >
                            DocuFlow
                        </span>
                    </a>
 
                    <nav class="hidden items-center space-x-1 text-xs font-medium md:flex">
                        <a
                            href="/"
                            class="rounded-lg px-3 py-1.5 transition
                                {currentPath === '/'
                                ? 'bg-indigo-600/10 font-semibold text-indigo-400'
                                : 'text-slate-400 hover:bg-slate-900 hover:text-white'}"
                        >
                            New Import
                        </a>
                        <a
                            href="/history"
                            class="rounded-lg px-3 py-1.5 transition
                                {currentPath.startsWith('/history')
                                ? 'bg-indigo-600/10 font-semibold text-indigo-400'
                                : 'text-slate-400 hover:bg-slate-900 hover:text-white'}"
                        >
                            History
                        </a>
                        <a
                            href="/settings"
                            class="rounded-lg px-3 py-1.5 transition
                                {currentPath.startsWith('/settings')
                                ? 'bg-indigo-600/10 font-semibold text-indigo-400'
                                : 'text-slate-400 hover:bg-slate-900 hover:text-white'}"
                        >
                            Settings
                        </a>
                    </nav>
                </div>
 
                <!-- Right Actions -->
                <div class="flex items-center space-x-3 text-xs">
                    <!-- Safe Connection Status Pill -->
                    {#if data?.strapiUrl}
                        <div
                            class="hidden items-center gap-2 rounded-full border border-emerald-900/60 bg-emerald-950/40 px-3 py-1 text-[11px] sm:flex"
                            title={`Connected to ${data.strapiUrl}`}
                        >
                            <span class="relative flex h-2 w-2">
                                <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                                <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                            </span>
                            <span class="text-slate-400">Strapi:</span>
                            <span class="max-w-[220px] truncate font-mono font-medium text-emerald-300">
                                {data.strapiUrl.replace(/^https?:\/\//, '')}
                            </span>
                        </div>
                    {/if}
 
                    <form method="POST" action="/login?/logout">
                        <button
                            type="submit"
                            class="cursor-pointer rounded-lg border border-slate-800 px-3 py-1.5 text-slate-400 transition hover:border-rose-900/60 hover:bg-rose-950/20 hover:text-rose-300"
                        >
                            Logout
                        </button>
                    </form>
                </div>
            </div>
        </header>
    {/if}
 
    <!-- Main Body -->
    <main class="flex min-h-0 flex-1 flex-col">
        {@render children()}
    </main>
</div>
 
<style>
    .home-shell {
        height: 100dvh;
        min-height: 0;
        overflow: hidden;
    }
</style>
 
 