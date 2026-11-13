<script>
	/**
	 * @type {{
	 *   payload?: any
	 * }}
	 */
	let { payload = {} } = $props();

	let open = $state(false);
	let copied = $state(false);

	function copyJson() {
		navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<div class="df-card overflow-hidden text-xs">
	<div
		class="flex items-center justify-between gap-2 bg-[#0b0e14] px-4 py-3 {open
			? 'border-b border-slate-800/80'
			: ''}"
	>
		<button
			type="button"
			aria-expanded={open}
			class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left font-semibold text-slate-200 transition hover:text-white"
			onclick={() => (open = !open)}
		>
			<svg
				class="h-3.5 w-3.5 shrink-0 text-indigo-400 transition-transform {open ? 'rotate-90' : ''}"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2.5"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
			</svg>
			<span class="truncate">Advanced: Strapi Payload Preview</span>
		</button>

		{#if open}
			<button
				type="button"
				class="df-btn-secondary min-h-[28px] shrink-0 rounded-lg px-2.5 py-1 text-[11px]"
				onclick={copyJson}
			>
				{copied ? 'Copied!' : 'Copy JSON'}
			</button>
		{/if}
	</div>

	{#if open}
		<pre
			class="max-h-72 overflow-auto bg-[#07090d] p-4 font-mono text-[11px] leading-relaxed text-emerald-300">
{JSON.stringify(payload, null, 2)}
		</pre>
	{/if}
</div>
