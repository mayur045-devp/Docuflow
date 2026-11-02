<script>
	/**
	 * @type {{
	 *   steps?: string[],
	 *   currentStep?: number
	 * }}
	 */
	let {
		steps = ['Upload & Parse', 'AI Extract', 'Review & Edit', 'Approve & Import'],
		currentStep = 0
	} = $props();
</script>

<div class="w-full px-2 py-4">
	<div class="mx-auto flex max-w-3xl items-center justify-between">
		{#each steps as step, idx}
			<div class="flex flex-1 items-center {idx === steps.length - 1 ? 'flex-initial' : ''}">
				<div class="flex flex-col items-center">
					<div
						class="flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition
							{idx < currentStep
							? 'border-indigo-500 bg-indigo-600 text-white'
							: idx === currentStep
								? 'border-indigo-500 bg-indigo-500/20 text-indigo-400 ring-4 ring-indigo-500/20'
								: 'border-slate-800 bg-slate-900 text-slate-500'}"
					>
						{#if idx < currentStep}
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2.5"
									d="M5 13l4 4L19 7"
								/>
							</svg>
						{:else}
							{idx + 1}
						{/if}
					</div>
					<span
						class="mt-1.5 text-xs font-medium whitespace-nowrap
							{idx === currentStep
							? 'font-semibold text-indigo-400'
							: idx < currentStep
								? 'text-slate-300'
								: 'text-slate-500'}"
					>
						{step}
					</span>
				</div>

				{#if idx < steps.length - 1}
					<div
						class="mx-3 mb-5 h-0.5 flex-1 transition-colors
							{idx < currentStep ? 'bg-indigo-600' : 'bg-slate-800'}"
					></div>
				{/if}
			</div>
		{/each}
	</div>
</div>
