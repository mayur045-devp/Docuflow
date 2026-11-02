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
			? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
			: confidence >= 0.65
				? 'bg-amber-950/80 text-amber-400 border-amber-800'
				: 'bg-rose-950/80 text-rose-400 border-rose-800'
	);

	let percent = $derived(Math.round(confidence * 100));
</script>

<div
	class="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-xs {colorClass}"
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
		<span class="font-sans text-[10px] font-bold tracking-wider text-rose-400 uppercase"
			>Review</span
		>
	{/if}
</div>
