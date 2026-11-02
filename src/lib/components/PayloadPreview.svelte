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

<div class="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 text-xs">
	<div
		class="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 px-3.5 py-2.5"
	>
		<button
			type="button"
			class="flex cursor-pointer items-center gap-2 font-semibold text-slate-300 hover:text-white"
			onclick={() => (open = !open)}
		>
			<span class="font-bold text-indigo-400">{open ? '▼' : '►'}</span>
			<span>Advanced: Strapi Payload Preview</span>
		</button>

		{#if open}
			<button
				type="button"
				class="cursor-pointer rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300 transition hover:bg-slate-700"
				onclick={copyJson}
			>
				{copied ? 'Copied!' : 'Copy JSON'}
			</button>
		{/if}
	</div>

	{#if open}
		<pre
			class="max-h-72 overflow-x-auto bg-slate-950 p-4 font-mono text-[11px] leading-relaxed text-emerald-400">
{JSON.stringify(payload, null, 2)}
		</pre>
	{/if}
</div>
