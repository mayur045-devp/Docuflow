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
	<div class="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/8 p-4">
		<div class="flex items-center gap-2 text-xs font-semibold text-amber-200 sm:text-sm">
			<svg
				class="h-4 w-4 shrink-0 text-amber-400"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
				/>
			</svg>
			<span class="tabular-nums">
				Schema Validation &amp; Extraction Notices ({issues.length + warnings.length})
			</span>
		</div>

		{#if issues.length > 0}
			<ul class="space-y-2 text-xs">
				{#each issues as issue}
					<li class="flex items-start gap-2.5">
						<span
							class="mt-0.5 inline-block shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold {issue.severity ===
							'warning'
								? 'border-amber-500/35 bg-amber-500/15 text-amber-300'
								: 'border-rose-500/35 bg-rose-500/15 text-rose-300'}"
						>
							{issue.severity === 'warning' ? 'WARN' : 'ERROR'}
						</span>
						<button
							type="button"
							class="min-w-0 cursor-pointer text-left leading-relaxed text-slate-300 underline decoration-slate-600 underline-offset-2 transition hover:text-white hover:decoration-indigo-400"
							onclick={() => scrollToField(issue.path)}
						>
							<span class="font-mono font-semibold break-all text-indigo-300">{issue.path}</span>:
							{issue.message}
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		{#if warnings.length > 0}
			<div class="space-y-1.5 border-t border-amber-500/20 pt-2.5 text-xs text-amber-200/85">
				{#each warnings as w}
					<div class="flex items-start gap-2 leading-relaxed">
						<span class="text-amber-400">&bull;</span>
						<span>{w}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}
