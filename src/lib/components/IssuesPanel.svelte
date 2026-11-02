<script>
	/**
	 * @type {{
	 *   issues?: { path: string, message: string, severity?: 'error' | 'warning' }[],
	 *   warnings?: string[],
	 *   onSelectField?: (path: string) => void
	 * }}
	 */
	let { issues = [], warnings = [], onSelectField } = $props();

	function scrollToField(path) {
		if (onSelectField) {
			onSelectField(path);
		}
		const el = document.getElementById(`field-${path}`);
		if (el) {
			el.scrollIntoView({ behavior: 'smooth', block: 'center' });
			el.focus();
		}
	}
</script>

{#if (issues && issues.length > 0) || (warnings && warnings.length > 0)}
	<div class="space-y-3 rounded-xl border border-amber-900/60 bg-amber-950/30 p-4">
		<div class="flex items-center gap-2 text-sm font-semibold text-amber-300">
			<svg class="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
				/>
			</svg>
			<span>Schema Validation & Extraction Notices ({issues.length + warnings.length})</span>
		</div>

		{#if issues.length > 0}
			<ul class="space-y-1.5 text-xs">
				{#each issues as issue}
					<li class="flex items-start gap-2">
						<span
							class="py-0.2 mt-0.5 inline-block rounded px-1.5 font-mono text-[10px] font-bold {issue.severity ===
							'warning'
								? 'bg-amber-900/80 text-amber-300'
								: 'bg-rose-900/80 text-rose-300'}"
						>
							{issue.severity === 'warning' ? 'WARN' : 'ERROR'}
						</span>
						<button
							type="button"
							class="cursor-pointer text-left text-slate-300 underline decoration-slate-600 hover:text-white hover:decoration-indigo-400"
							onclick={() => scrollToField(issue.path)}
						>
							<span class="font-mono font-medium text-indigo-400">{issue.path}</span>: {issue.message}
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		{#if warnings.length > 0}
			<div class="space-y-1 border-t border-amber-900/40 pt-2 text-xs text-amber-200/80">
				{#each warnings as w}
					<div class="flex items-start gap-1.5">
						<span class="text-amber-400">&bull;</span>
						<span>{w}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}
