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

<nav aria-label="Import workflow progress" class="w-full py-2 sm:py-3">
	<!-- Desktop & Tablet Stepper -->
	<ol class="mx-auto hidden max-w-3xl items-start justify-between sm:flex">
		{#each steps as step, idx}
			<li class="flex items-center {idx < steps.length - 1 ? 'flex-1' : 'shrink-0'}">
				<div class="flex flex-col items-center">
					<div
						aria-current={idx === currentStep ? 'step' : undefined}
						class="flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold tabular-nums transition-all
							{idx < currentStep
							? 'border-indigo-500 bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
							: idx === currentStep
								? 'border-indigo-400 bg-indigo-500/15 text-indigo-300 ring-4 ring-indigo-500/15'
								: 'border-slate-800 bg-[#0f131a] text-slate-500'}"
					>
						{#if idx < currentStep}
							<svg
								class="h-4 w-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2.5"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
							</svg>
						{:else}
							{idx + 1}
						{/if}
					</div>
					<span
						class="mt-2 text-xs font-medium whitespace-nowrap transition-colors
							{idx === currentStep
							? 'font-semibold text-indigo-300'
							: idx < currentStep
								? 'text-slate-300'
								: 'text-slate-500'}"
					>
						{step}
					</span>
				</div>

				{#if idx < steps.length - 1}
					<div
						class="mx-3 mt-4 h-0.5 flex-1 rounded-full transition-colors
							{idx < currentStep ? 'bg-indigo-600' : 'bg-slate-800'}"
					></div>
				{/if}
			</li>
		{/each}
	</ol>

	<!-- Compact Mobile Stepper (< 640px) -->
	<div class="space-y-2 sm:hidden">
		<div class="flex items-center justify-between gap-1.5 px-1">
			{#each steps as step, idx}
				<div class="flex items-center {idx < steps.length - 1 ? 'flex-1' : 'shrink-0'}">
					<div
						aria-current={idx === currentStep ? 'step' : undefined}
						title={step}
						class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold tabular-nums transition-all
							{idx < currentStep
							? 'border-indigo-500 bg-indigo-600 text-white'
							: idx === currentStep
								? 'border-indigo-400 bg-indigo-500/20 text-indigo-300 ring-4 ring-indigo-500/15'
								: 'border-slate-800 bg-[#0f131a] text-slate-500'}"
					>
						{#if idx < currentStep}
							<svg
								class="h-3.5 w-3.5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2.5"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
							</svg>
						{:else}
							{idx + 1}
						{/if}
					</div>

					{#if idx < steps.length - 1}
						<div
							class="mx-2 h-0.5 flex-1 rounded-full transition-colors
								{idx < currentStep ? 'bg-indigo-600' : 'bg-slate-800'}"
						></div>
					{/if}
				</div>
			{/each}
		</div>

		<div class="flex items-center justify-between px-1 text-xs">
			<span class="font-semibold text-indigo-300">{steps[currentStep] || ''}</span>
			<span class="font-mono text-[11px] text-slate-500 tabular-nums">
				Step {currentStep + 1} / {steps.length}
			</span>
		</div>
	</div>
</nav>
