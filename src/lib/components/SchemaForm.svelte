<script>
	import ConfidenceBadge from './ConfidenceBadge.svelte';
	import RichTextEditor from './RichTextEditor.svelte';
	import MediaField from './MediaField.svelte';
	import RelationField from './RelationField.svelte';
	import RepeatableField from './RepeatableField.svelte';
	import DynamicZoneField from './DynamicZoneField.svelte';
	import SchemaForm from './SchemaForm.svelte';
	import { generateSlug } from '../shared/slug.js';

	/**
	 * @type {{
	 *   schema: any,
	 *   data?: any,
	 *   jobId: string,
	 *   images?: any[],
	 *   pathPrefix?: string,
	 *   fieldNotes?: any[],
	 *   issues?: any[],
	 *   onfocusfield?: (path: string) => void,
	 *   onchange?: (val: any) => void
	 * }}
	 */
	let {
		schema,
		data = $bindable({}),
		jobId,
		images = [],
		pathPrefix = '',
		fieldNotes = [],
		issues = [],
		onfocusfield,
		onchange
	} = $props();

	function getFieldNote(fieldKey) {
		const fullPath = `${pathPrefix}${fieldKey}`;
		return (fieldNotes || []).find((n) => n.path === fullPath || n.path === fieldKey);
	}

	function getFieldIssue(fieldKey) {
		const fullPath = `${pathPrefix}${fieldKey}`;
		return (issues || []).find((i) => i.path === fullPath || i.path === fieldKey);
	}

	function handleFieldFocus(fieldKey) {
		if (onfocusfield) {
			onfocusfield(`${pathPrefix}${fieldKey}`);
		}
	}

	function updateField(fieldKey, newVal) {
		data[fieldKey] = newVal;
		if (onchange) {
			onchange(data);
		}
	}
</script>

<div class="space-y-4">
	{#if schema && schema.attributes}
		{#each Object.entries(schema.attributes) as [key, attr]}
			{@const note = getFieldNote(key)}
			{@const issue = getFieldIssue(key)}
			{@const fullPath = `${pathPrefix}${key}`}

			<div
				id={`field-${fullPath}`}
				class="space-y-1.5 rounded-xl border bg-slate-900/60 p-3.5 transition-all duration-150
					{issue ? 'border-rose-800/80 bg-rose-950/20' : 'border-slate-800 hover:border-slate-700'}"
			>
				<!-- Label and Confidence Badge Row -->
				<div class="flex items-center justify-between gap-2">
					<label
						for={`input-${fullPath}`}
						class="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-200"
					>
						<span>{key}</span>
						{#if attr.required}
							<span class="font-bold text-rose-400" title="Required field">*</span>
						{/if}
						<span class="font-mono text-[10px] font-normal text-slate-500">({attr.type})</span>
					</label>

					{#if note}
						<ConfidenceBadge confidence={note.confidence} note={note.note} />
					{/if}
				</div>

				<!-- Field Input based on attribute type -->
				{#if attr.type === 'string' || attr.type === 'email'}
					<input
						id={`input-${fullPath}`}
						type={attr.type === 'email' ? 'email' : 'text'}
						value={data[key] || ''}
						onfocus={() => handleFieldFocus(key)}
						oninput={(e) => updateField(key, e.currentTarget.value)}
						class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-600 transition focus:border-indigo-500 focus:outline-none"
					/>
				{:else if attr.type === 'text'}
					<textarea
						id={`input-${fullPath}`}
						value={data[key] || ''}
						rows={3}
						onfocus={() => handleFieldFocus(key)}
						oninput={(e) => updateField(key, e.currentTarget.value)}
						class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-600 transition focus:border-indigo-500 focus:outline-none"
					></textarea>
				{:else if attr.type === 'uid'}
					<div class="flex items-center gap-2">
						<input
							id={`input-${fullPath}`}
							type="text"
							value={data[key] || ''}
							onfocus={() => handleFieldFocus(key)}
							oninput={(e) => updateField(key, e.currentTarget.value)}
							placeholder="url-friendly-slug"
							class="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-indigo-300 placeholder-slate-600 transition focus:border-indigo-500 focus:outline-none"
						/>
						{#if attr.targetField}
							<button
								type="button"
								class="cursor-pointer rounded-xl bg-slate-800 px-2.5 py-2 text-xs text-slate-300 hover:bg-slate-700"
								title={`Regenerate from ${attr.targetField}`}
								onclick={() => updateField(key, generateSlug(data[attr.targetField] || ''))}
							>
								Sync
							</button>
						{/if}
					</div>
				{:else if attr.type === 'blocks' || attr.type === 'richtext'}
					<RichTextEditor
						id={`input-${fullPath}`}
						value={data[key] || ''}
						onchange={(val) => updateField(key, val)}
					/>
				{:else if attr.type === 'number'}
					<input
						id={`input-${fullPath}`}
						type="number"
						value={data[key] !== undefined ? data[key] : ''}
						onfocus={() => handleFieldFocus(key)}
						oninput={(e) => updateField(key, e.currentTarget.valueAsNumber)}
						class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-600 transition focus:border-indigo-500 focus:outline-none"
					/>
				{:else if attr.type === 'boolean'}
					<label class="flex cursor-pointer items-center gap-2.5 py-1">
						<input
							id={`input-${fullPath}`}
							type="checkbox"
							checked={Boolean(data[key])}
							onchange={(e) => updateField(key, e.currentTarget.checked)}
							class="h-4 w-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
						/>
						<span class="text-xs text-slate-300">Enabled</span>
					</label>
				{:else if attr.type === 'date'}
					<input
						id={`input-${fullPath}`}
						type="date"
						value={data[key] || ''}
						onfocus={() => handleFieldFocus(key)}
						oninput={(e) => updateField(key, e.currentTarget.value)}
						class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-600 transition focus:border-indigo-500 focus:outline-none"
					/>
				{:else if attr.type === 'enumeration'}
					<select
						id={`input-${fullPath}`}
						value={data[key] || ''}
						onfocus={() => handleFieldFocus(key)}
						onchange={(e) => updateField(key, e.currentTarget.value)}
						class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 transition focus:border-indigo-500 focus:outline-none"
					>
						<option value="">Select option...</option>
						{#each attr.enum || [] as opt}
							<option value={opt}>{opt}</option>
						{/each}
					</select>
				{:else if attr.type === 'media'}
					<MediaField
						{jobId}
						value={data[key]}
						{images}
						onchange={(val) => updateField(key, val)}
					/>
				{:else if attr.type === 'relation'}
					<RelationField
						id={`input-${fullPath}`}
						target={attr.target}
						displayField={attr.displayField}
						value={data[key]}
						onchange={(val) => updateField(key, val)}
					/>
				{:else if attr.type === 'component'}
					{#if attr.repeatable}
						<RepeatableField
							schema={attr.schema}
							value={data[key]}
							{jobId}
							{images}
							pathPrefix={`${fullPath}.`}
							{fieldNotes}
							{onfocusfield}
							onchange={(val) => updateField(key, val)}
						/>
					{:else}
						<div class="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
							<SchemaForm
								schema={attr.schema}
								data={data[key] || {}}
								{jobId}
								{images}
								pathPrefix={`${fullPath}.`}
								{fieldNotes}
								{issues}
								{onfocusfield}
								onchange={(val) => updateField(key, val)}
							/>
						</div>
					{/if}
				{:else if attr.type === 'dynamiczone'}
					<DynamicZoneField
						id={`input-${fullPath}`}
						components={attr.components}
						schemas={attr.schemas}
						value={data[key]}
						{jobId}
						{images}
						pathPrefix={`${fullPath}.`}
						{fieldNotes}
						{onfocusfield}
						onchange={(val) => updateField(key, val)}
					/>
				{:else}
					<div class="text-xs text-slate-500 italic">
						Manual only / unsupported type ({attr.type})
					</div>
				{/if}

				<!-- Inline Validation Error -->
				{#if issue}
					<p class="flex items-center gap-1 pt-0.5 text-xs font-medium text-rose-400">
						<span>&bull;</span>
						<span>{issue.message}</span>
					</p>
				{/if}
			</div>
		{/each}
	{/if}
</div>
