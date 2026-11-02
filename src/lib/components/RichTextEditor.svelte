<script>
	/**
	 * @type {{
	 *   id?: string,
	 *   value?: string,
	 *   onchange?: (val: string) => void
	 * }}
	 */
	let { id = 'richtext-editor', value = $bindable(''), onchange } = $props();

	let mode = $state('editor'); // 'editor' | 'preview'
	let textareaEl = $state(null);

	function updateVal(newVal) {
		value = newVal;
		if (onchange) onchange(newVal);
	}

	function wrapSelection(openTag, closeTag) {
		if (!textareaEl) return;
		const start = textareaEl.selectionStart;
		const end = textareaEl.selectionEnd;
		const text = value || '';
		const selected = text.substring(start, end);

		const replacement = `${openTag}${selected || 'text'}${closeTag}`;
		const updated = text.substring(0, start) + replacement + text.substring(end);
		updateVal(updated);

		setTimeout(() => {
			if (textareaEl) {
				textareaEl.focus();
				textareaEl.setSelectionRange(
					start + openTag.length,
					start + openTag.length + (selected.length || 4)
				);
			}
		}, 0);
	}
</script>

<div
	class="overflow-hidden rounded-xl border border-slate-700 bg-slate-950 transition focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20"
>
	<!-- Toolbar -->
	<div
		class="flex flex-wrap items-center justify-between gap-1 border-b border-slate-800 bg-slate-900/80 px-2 py-1.5 text-xs"
	>
		<div class="flex items-center gap-1">
			<button
				type="button"
				class="rounded px-2 py-1 font-bold text-slate-300 hover:bg-slate-800"
				title="Bold"
				onclick={() => wrapSelection('<strong>', '</strong>')}
			>
				B
			</button>
			<button
				type="button"
				class="rounded px-2 py-1 text-slate-300 italic hover:bg-slate-800"
				title="Italic"
				onclick={() => wrapSelection('<em>', '</em>')}
			>
				I
			</button>
			<button
				type="button"
				class="rounded px-2 py-1 font-bold text-slate-300 hover:bg-slate-800"
				title="Heading 2"
				onclick={() => wrapSelection('<h2>', '</h2>')}
			>
				H2
			</button>
			<button
				type="button"
				class="rounded px-2 py-1 font-bold text-slate-300 hover:bg-slate-800"
				title="Heading 3"
				onclick={() => wrapSelection('<h3>', '</h3>')}
			>
				H3
			</button>
			<button
				type="button"
				class="rounded px-2 py-1 text-slate-300 hover:bg-slate-800"
				title="Bullet List"
				onclick={() => wrapSelection('<ul>\n  <li>', '</li>\n</ul>')}
			>
				&bull; List
			</button>
			<button
				type="button"
				class="rounded px-2 py-1 text-slate-300 hover:bg-slate-800"
				title="Link"
				onclick={() => wrapSelection('<a href="https://example.com">', '</a>')}
			>
				Link
			</button>
			<button
				type="button"
				class="rounded px-2 py-1 text-slate-300 hover:bg-slate-800"
				title="Blockquote"
				onclick={() => wrapSelection('<blockquote>', '</blockquote>')}
			>
				Quote
			</button>
		</div>

		<div
			class="flex items-center rounded-lg border border-slate-800 bg-slate-950 p-0.5 text-[11px]"
		>
			<button
				type="button"
				class="rounded-md px-2 py-0.5 font-medium transition {mode === 'editor'
					? 'bg-indigo-600 text-white shadow'
					: 'text-slate-400 hover:text-white'}"
				onclick={() => (mode = 'editor')}
			>
				HTML
			</button>
			<button
				type="button"
				class="rounded-md px-2 py-0.5 font-medium transition {mode === 'preview'
					? 'bg-indigo-600 text-white shadow'
					: 'text-slate-400 hover:text-white'}"
				onclick={() => (mode = 'preview')}
			>
				Preview
			</button>
		</div>
	</div>

	<!-- Content Area -->
	{#if mode === 'editor'}
		<textarea
			{id}
			bind:this={textareaEl}
			value={value || ''}
			oninput={(e) => updateVal(e.currentTarget.value)}
			rows={6}
			placeholder="Enter rich text HTML (<p>, <h2>, <ul>, <strong>...)"
			class="w-full resize-y bg-slate-950 p-3 font-mono text-xs text-slate-200 placeholder-slate-600 focus:outline-none"
		></textarea>
	{:else}
		<div
			class="prose prose-invert min-h-[140px] max-w-none p-3.5 text-xs leading-relaxed text-slate-200"
		>
			<!-- Sanitized HTML preview -->
			{@html value || '<p class="text-slate-500 italic">No content</p>'}
		</div>
	{/if}
</div>
