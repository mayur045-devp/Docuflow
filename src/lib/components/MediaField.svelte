<script>
	/**
	 * @type {{
	 *   jobId: string,
	 *   value?: any,
	 *   images?: { id: string, alt?: string }[],
	 *   onchange?: (val: any) => void
	 * }}
	 */
	let { jobId, value = $bindable(null), images = [], onchange } = $props();

	let selectedImageId = $derived(
		typeof value === 'object' && value?.$docImage
			? value.$docImage
			: typeof value === 'string' && value.startsWith('img-')
				? value
				: value
					? String(value)
					: ''
	);

	function selectImage(imgId) {
		value = imgId ? imgId : null;
		if (onchange) onchange(value);
	}
</script>

<div class="space-y-3">
	<div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
		<!-- Option: None -->
		<button
			type="button"
			class="flex h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-2 text-xs transition
				{!selectedImageId
				? 'border-indigo-400 bg-indigo-500/12 text-indigo-200 ring-2 ring-indigo-500/20'
				: 'border-slate-700/80 bg-[#0b0e14] text-slate-500 hover:border-slate-600 hover:text-slate-300'}"
			onclick={() => selectImage(null)}
		>
			<svg
				class="mb-1 h-5 w-5"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
			</svg>
			<span>No image</span>
		</button>

		<!-- Images from document -->
		{#each images as img}
			<button
				type="button"
				class="group relative flex h-24 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border p-1.5 transition
					{selectedImageId === img.id
					? 'border-indigo-400 bg-indigo-500/12 ring-2 ring-indigo-500/20'
					: 'border-slate-800 bg-[#0b0e14] hover:border-slate-600'}"
				onclick={() => selectImage(img.id)}
			>
				<img
					src={`/api/jobs/${jobId}/images/${img.id}`}
					alt={img.alt || img.id}
					class="h-14 w-full rounded object-contain"
					loading="lazy"
				/>
				<span class="mt-1 w-full truncate text-center font-mono text-[10px] text-slate-400">
					{img.id}
				</span>

				{#if selectedImageId === img.id}
					<div
						class="absolute top-1.5 right-1.5 rounded-full bg-indigo-600 p-0.5 text-white shadow"
					>
						<svg
							class="h-3 w-3"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="3"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
						</svg>
					</div>
				{/if}
			</button>
		{/each}
	</div>

	{#if images.length === 0}
		<p class="text-xs text-slate-500 italic">
			No embedded images were found in the uploaded Word document.
		</p>
	{/if}
</div>
