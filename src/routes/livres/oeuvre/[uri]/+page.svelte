<script lang="ts">
	import { enhance } from '$app/forms';
	import BackButton from '$lib/components/BackButton.svelte';
	import BookBanner from '$lib/components/BookBanner.svelte';
	import BookCover from '$lib/components/BookCover.svelte';
	import { formatVolumeLabel } from '$lib/books';
	import { formatDateShort } from '$lib/format';

	let { data, form } = $props();
	let adding = $state(false);

	const book = $derived(data.book);
	const navigation = $derived(data.navigation);
	// Même repère que dans la liste de la série : « Tome 51 · Les onze supernovae ».
	const volume = $derived(
		formatVolumeLabel({
			seriesTitle: book.seriesTitle,
			title: book.title,
			subtitle: book.subtitle,
			volume: book.volume
		})
	);

	/** Les sources donnent tantôt une date complète, tantôt une simple année. */
	function publishLabel(value: string | null): string | null {
		if (!value) return null;
		return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDateShort(value) : value;
	}
</script>

<svelte:head><title>{book.title} — TV Time local</title></svelte:head>

<div class="relative -mx-4 -mt-5 h-40 sm:h-52">
	<BookBanner url={book.coverUrl} />
	<BackButton
		fallback={navigation ? navigation.seriesHref : '/livres'}
		class="absolute top-3 left-3 flex h-9 w-9 items-center justify-center rounded-full bg-bg/70 text-lg backdrop-blur hover:bg-bg"
	/>
</div>

<div class="relative -mt-14 flex items-end gap-4">
	<div class="shrink-0 overflow-hidden rounded-lg shadow-lg ring-1 ring-line" style="width: 6.75rem">
		<div class="aspect-[2/3]"><BookCover url={book.coverUrl} alt={book.title} /></div>
	</div>
	<div class="min-w-0 flex-1 pb-1">
		{#if book.seriesTitle}
			{@const href = navigation?.seriesHref ?? (book.seriesUri ? `/livres/series/${encodeURIComponent(book.seriesUri)}` : null)}
			{#if href}
				<a {href} class="text-sm font-medium text-mut hover:text-brand hover:underline">{book.seriesTitle}</a>
			{:else}
				<p class="text-sm font-medium text-mut">{book.seriesTitle}</p>
			{/if}
		{/if}
		<h1 class="mt-0.5 text-xl leading-tight font-bold">{volume.title ?? book.title}</h1>
		{#if book.seriesTitle}<p class="mt-0.5 text-sm text-brand">{volume.label}</p>{/if}
		<p class="mt-1 text-sm">{book.authors.join(', ') || 'Auteur inconnu'}</p>
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

{#if navigation?.prev || navigation?.next}
	<nav class="mt-8 flex items-stretch justify-between gap-3 border-t border-line pt-4">
		{#if navigation.prev}
			<a href={navigation.prev.href} class="group min-w-0 flex-1">
				<p class="text-xs text-mut">← Tome précédent</p>
				<p class="mt-0.5 truncate text-sm font-medium group-hover:text-brand">
					{navigation.prev.label}{#if navigation.prev.title}&nbsp;· {navigation.prev.title}{/if}
				</p>
			</a>
		{:else}
			<span class="flex-1"></span>
		{/if}
		{#if navigation.next}
			<a href={navigation.next.href} class="group min-w-0 flex-1 text-right">
				<p class="text-xs text-mut">Tome suivant →</p>
				<p class="mt-0.5 truncate text-sm font-medium group-hover:text-brand">
					{navigation.next.label}{#if navigation.next.title}&nbsp;· {navigation.next.title}{/if}
				</p>
			</a>
		{/if}
	</nav>
{/if}

{#if book.isbn13}
	<p class="mt-6 border-t border-line pt-4 font-mono text-xs text-mut">ISBN {book.isbn13}</p>
{/if}
