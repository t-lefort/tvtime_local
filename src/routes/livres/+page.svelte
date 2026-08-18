<script lang="ts">
	import BookCover from '$lib/components/BookCover.svelte';
	import SortToggle from '$lib/components/SortToggle.svelte';
	import { DEFAULT_SORT } from '$lib/sort';
	let { data } = $props();
	const chips = [
		{ key: 'tous', label: 'Tous' },
		{ key: 'collection', label: 'Ma collection' },
		{ key: 'souhaits', label: 'Envies' },
		{ key: 'nonlus', label: 'À lire' },
		{ key: 'encours', label: 'En cours' },
		{ key: 'lus', label: 'Lus' },
		{ key: 'pretes', label: 'Prêtés' },
		{ key: 'favoris', label: 'Favoris' }
	];
	function filterHref(key: string) {
		const params = new URLSearchParams();
		if (key !== 'tous') params.set('filtre', key);
		if (data.sort !== DEFAULT_SORT) params.set('tri', data.sort);
		if (data.q) params.set('q', data.q);
		return params.size ? `/livres?${params}` : '/livres';
	}
</script>

<svelte:head><title>Livres — TV Time local</title></svelte:head>

<div class="mb-4 flex items-center justify-between gap-3">
	<h1 class="text-2xl font-bold">Livres</h1>
	<a href="/livres/ajouter" class="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-ink">+ Ajouter</a>
</div>

<form method="GET" class="mb-3">
	{#if data.filter !== 'tous'}<input type="hidden" name="filtre" value={data.filter} />{/if}
	{#if data.sort !== DEFAULT_SORT}<input type="hidden" name="tri" value={data.sort} />{/if}
	<input name="q" value={data.q} type="search" placeholder="Titre, série, auteur, éditeur…" class="w-full rounded-xl border border-line bg-card px-4 py-3 focus:border-brand focus:outline-none" />
</form>

<div class="scrollbar-none -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
	{#each chips as chip (chip.key)}
		<a href={filterHref(chip.key)} data-sveltekit-replacestate class="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium {data.filter === chip.key ? 'bg-brand text-brand-ink' : 'bg-card text-mut'}">
			{chip.label} <span class="opacity-70">· {data.counts[chip.key as keyof typeof data.counts]}</span>
		</a>
	{/each}
</div>

<SortToggle base="/livres" sort={data.sort} params={{ ...(data.filter === 'tous' ? {} : { filtre: data.filter }), ...(data.q ? { q: data.q } : {}) }} />

{#if data.books.length === 0}
	<div class="rounded-xl bg-card p-8 text-center text-mut">
		<p class="mb-2 text-3xl">📚</p>
		<p>{data.q ? 'Aucun livre ne correspond à cette recherche.' : 'Aucun livre dans cette catégorie.'}</p>
	</div>
{:else}
	<div class="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
		{#each data.books as book (book.id)}
			<a href="/livres/{book.id}" class="group min-w-0">
				<div class="relative aspect-[2/3] overflow-hidden rounded-lg bg-card shadow-md">
					<BookCover url={book.coverUrl} alt={book.title} />
					{#if book.favorite}<span class="absolute top-1.5 right-1.5 rounded-full bg-bg/75 px-1.5 py-0.5 text-xs">⭐</span>{/if}
					{#if book.readingStatus === 'read'}<span class="absolute bottom-1.5 left-1.5 rounded-full bg-brand px-1.5 py-0.5 text-xs text-brand-ink">✓ Lu</span>{/if}
				</div>
				<p class="mt-1.5 truncate text-sm font-medium group-hover:text-brand">{book.title}</p>
				<p class="truncate text-xs text-mut">{book.seriesTitle ?? book.authors.join(', ')}</p>
			</a>
		{/each}
	</div>
{/if}
