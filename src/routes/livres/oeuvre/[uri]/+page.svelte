<script lang="ts">
	import { enhance } from '$app/forms';
	import BackButton from '$lib/components/BackButton.svelte';
	import BookCover from '$lib/components/BookCover.svelte';
	import { formatDateShort } from '$lib/format';

	let { data, form } = $props();
	let adding = $state(false);

	const book = $derived(data.book);

	/** Les sources donnent tantôt une date complète, tantôt une simple année. */
	function publishLabel(value: string | null): string | null {
		if (!value) return null;
		return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDateShort(value) : value;
	}
</script>

<svelte:head><title>{book.title} — TV Time local</title></svelte:head>

<BackButton fallback="/livres" class="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-card text-lg" />

<div class="flex items-end gap-4">
	<div class="shrink-0 overflow-hidden rounded-lg shadow-lg ring-1 ring-line" style="width: 6.75rem">
		<div class="aspect-[2/3]"><BookCover url={book.coverUrl} alt={book.title} /></div>
	</div>
	<div class="min-w-0 flex-1 pb-1">
		<h1 class="text-xl leading-tight font-bold">{book.title}</h1>
		<p class="mt-1 text-sm">{book.authors.join(', ') || 'Auteur inconnu'}</p>
		{#if book.seriesTitle}
			<p class="mt-0.5 text-sm text-mut">
				{#if book.seriesUri}
					<a href="/livres/series/{encodeURIComponent(book.seriesUri)}" class="hover:text-brand hover:underline">
						{book.seriesTitle}
					</a>
				{:else}
					{book.seriesTitle}
				{/if}
				{book.volume ? ` · tome ${book.volume}` : ''}
			</p>
		{/if}
		<p class="mt-0.5 truncate text-xs text-mut">
			{[book.publisher, publishLabel(book.publishDate), book.pageCount ? `${book.pageCount} pages` : null]
				.filter(Boolean)
				.join(' · ')}
		</p>
	</div>
</div>

<div class="mt-5">
	{#if data.localId}
		<a
			href="/livres/{data.localId}"
			class="inline-block rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand"
		>
			Voir dans ma bibliothèque
		</a>
	{:else}
		<form
			method="POST"
			action="?/add"
			use:enhance={() => {
				adding = true;
				return async ({ update }) => {
					await update();
					adding = false;
				};
			}}
		>
			<button
				disabled={adding}
				class="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:opacity-90 disabled:opacity-50"
			>
				{adding ? 'Ajout…' : '+ Ajouter à ma bibliothèque'}
			</button>
		</form>
	{/if}
</div>

{#if form?.error}<p class="mt-3 text-sm text-red-400">{form.error}</p>{/if}

{#if book.description}
	<p class="mt-5 text-sm leading-relaxed text-mut">{book.description}</p>
{/if}

{#if book.isbn13}
	<p class="mt-6 border-t border-line pt-4 font-mono text-xs text-mut">ISBN {book.isbn13}</p>
{/if}
