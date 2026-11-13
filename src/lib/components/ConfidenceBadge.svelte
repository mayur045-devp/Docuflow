<script>
	/**
	 * @type {{
	 *   confidence?: number,
	 *   note?: string
	 * }}
	 */
	let { confidence = 1.0, note = '' } = $props();

	let colorClass = $derived(
		confidence >= 0.85
			? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
			: confidence >= 0.65
				? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
				: 'border-rose-500/35 bg-rose-500/10 text-rose-300'
	);

	let percent = $derived(Math.round(confidence * 100));
</script>

<div
	class="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] tabular-nums {colorClass}"
	title={note ? `${note} (${percent}%)` : `Confidence: ${percent}%`}
>
	<span
		class="h-1.5 w-1.5 rounded-full {confidence >= 0.85
			? 'bg-emerald-400'
			: confidence >= 0.65
				? 'bg-amber-400'
				: 'bg-rose-400'}"
	></span>
	<span>{percent}%</span>
	{#if confidence < 0.65}
		<span class="font-sans text-[10px] font-bold tracking-wider text-rose-300 uppercase">
			Review
		</span>
	{/if}
</div>
