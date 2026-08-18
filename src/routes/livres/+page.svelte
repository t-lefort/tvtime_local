<script lang="ts">
	import BookCover from '$lib/components/BookCover.svelte';
	import LibraryHeader from '$lib/components/LibraryHeader.svelte';
	import LibrarySearch from '$lib/components/LibrarySearch.svelte';
	import SortToggle from '$lib/components/SortToggle.svelte';
	import { DEFAULT_SORT } from '$lib/sort';

	let { data } = $props();

	/** Conserve l'ordre et la recherche courants en changeant de filtre. */
	function filterHref(key: string) {
		const params = new URLSearchParams();
		if (key !== 'tous') params.set('filtre', key);
		if (data.sort !== DEFAULT_SORT) params.set('tri', data.sort);
		if (data.q) params.set('q', data.q);
		const query = params.toString();
		return query ? `/livres?${query}` : '/livres';
	}

	/** Paramètres à conserver dans les liens de tri et le champ de recherche. */
	const kept = $derived({
		...(data.filter === 'tous' ? {} : { filtre: data.filter }),
		...(data.q ? { q: data.q } : {})
	});

	const chips = [
		{ key: 'tous', label: 'Tous' },
		{ key: 'collection', label: 'Ma collection' },
		{ key: 'souhaits', label: 'Envies' },
		{ key: 'nonlus', label: 'À lire' },
		{ key: 'encours', label: 'En cours' },
		{ key: 'lus', label: 'Lus' },
		{ key: 'favoris', label: 'Favoris' }
	];
</script>

<svelte:head>
	<title>Livres — TV Time local</title>
</svelte:head>

<LibraryHeader current="livres" counts={data.libraryCounts} />

<LibrarySearch
	value={data.q}
	placeholder="Titre, série, auteur, éditeur…"
	hidden={data.filter === 'tous' ? {} : { filtre: data.filter }}
/>

<div class="scrollbar-none -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
	{#each chips as chip (chip.key)}
		<a
			href={filterHref(chip.key)}
			data-sveltekit-replacestate
			class="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors
				{data.filter === chip.key ? 'bg-brand text-brand-ink' : 'bg-card text-mut hover:bg-card-hover hover:text-ink'}"
		>
			{chip.label}
			<span class="opacity-70">· {data.counts[chip.key as keyof typeof data.counts]}</span>
		</a>
	{/each}
</div>

<SortToggle base="/livres" sort={data.sort} params={kept} />

{#if data.books.length === 0}
	<div class="rounded-xl bg-card p-8 text-center text-mut">
		<p class="mb-2 text-3xl">📚</p>
		{#if data.q}
			<p>Aucun livre ne correspond à cette recherche.</p>
		{:else if data.filter === 'tous'}
			<p>Aucun livre pour l'instant. Ajoutez-en via la recherche.</p>
		{:else}
			<p>Aucun livre dans cette catégorie.</p>
		{/if}
	</div>
{:else}
	<div class="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
		{#each data.books as book (book.id)}
			<a href="/livres/{book.id}" class="group min-w-0">
				<div class="relative aspect-[2/3] overflow-hidden rounded-lg bg-card shadow-md">
					<BookCover url={book.coverUrl} alt={book.title} />
					{#if book.favorite}
						<span class="absolute top-1.5 right-1.5 rounded-full bg-bg/70 px-1.5 py-0.5 text-xs">⭐</span>
					{/if}
					{#if book.wishlist && !book.inCollection}
						<span class="absolute top-1.5 left-1.5 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-semibold text-mut uppercase">Envie</span>
					{/if}
					{#if book.readingStatus === 'read'}
						<!-- Même pastille que les films vus, pour lire l'état d'un coup d'œil -->
						<span
							class="absolute bottom-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-brand-ink"
							title="Lu"
						>
							<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
								<path d="M4 12.5l5 5L20 6.5" />
							</svg>
						</span>
					{:else if book.readingStatus === 'reading'}
						<span class="absolute bottom-1.5 left-1.5 rounded-full bg-bg/80 px-2 py-0.5 text-[10px] font-semibold text-brand">En cours</span>
					{/if}
				</div>
				<p class="mt-1.5 truncate text-sm font-medium group-hover:text-brand">{book.title}</p>
				<p class="truncate text-xs text-mut">
					{book.seriesTitle
						? `${book.seriesTitle}${book.volume ? ` · T. ${book.volume}` : ''}`
						: book.authors.join(', ')}
				</p>
			</a>
		{/each}
	</div>
{/if}
