<script lang="ts">
	import BookCover from '$lib/components/BookCover.svelte';
	import LibraryHeader from '$lib/components/LibraryHeader.svelte';
	import LibrarySearch from '$lib/components/LibrarySearch.svelte';
	import SortToggle from '$lib/components/SortToggle.svelte';
	import { matchesQuery, parseQuery } from '$lib/library';
	import { updateListParams } from '$lib/library-nav';
	import { DEFAULT_SORT, type SortOrder } from '$lib/sort';

	let { data } = $props();

	type Book = (typeof data.books)[number];

	const chips = [
		{ key: 'tous', label: 'Tous', match: () => true },
		{ key: 'collection', label: 'Ma collection', match: (b: Book) => b.inCollection },
		{ key: 'souhaits', label: 'Envies', match: (b: Book) => b.wishlist },
		{ key: 'nonlus', label: 'À lire', match: (b: Book) => b.readingStatus === 'unread' },
		{ key: 'encours', label: 'En cours', match: (b: Book) => b.readingStatus === 'reading' },
		{ key: 'lus', label: 'Lus', match: (b: Book) => b.readingStatus === 'read' },
		{ key: 'favoris', label: 'Favoris', match: (b: Book) => b.favorite }
	];

	// Recherche, filtre et tri vivent côté page : ils réagissent à la frappe et
	// au clic sans recharger. Une vraie navigation les remet à ce que dit l'URL.
	// svelte-ignore state_referenced_locally
	let q = $state(data.q);
	// svelte-ignore state_referenced_locally
	let filter = $state(data.filter);
	// svelte-ignore state_referenced_locally
	let sort = $state<SortOrder>(data.sort);
	$effect(() => void (q = data.q));
	$effect(() => void (filter = data.filter));
	$effect(() => void (sort = data.sort));

	const sorted = $derived(
		[...data.books].sort((a, b) =>
			sort === 'alpha'
				? a.title.localeCompare(b.title, 'fr')
				: b.addedAt.localeCompare(a.addedAt) || a.title.localeCompare(b.title, 'fr')
		)
	);

	const needle = $derived(parseQuery(q).needle);
	const matching = $derived(
		sorted.filter((book) =>
			matchesQuery(needle, [book.title, book.seriesTitle, book.publisher, ...book.authors])
		)
	);

	// Les compteurs portent sur le résultat de la recherche : les puces disent
	// combien de titres restent dans chaque catégorie.
	const counts = $derived(
		Object.fromEntries(chips.map((chip) => [chip.key, matching.filter(chip.match).length]))
	);

	const books = $derived(matching.filter(chips.find((chip) => chip.key === filter)?.match ?? (() => true)));

	/** Conserve l'ordre et la recherche courants en changeant de filtre. */
	function filterHref(key: string) {
		const params = new URLSearchParams();
		if (key !== 'tous') params.set('filtre', key);
		if (sort !== DEFAULT_SORT) params.set('tri', sort);
		if (q.trim()) params.set('q', q.trim());
		const query = params.toString();
		return query ? `/livres?${query}` : '/livres';
	}

	function pick(event: MouseEvent, key: string) {
		if (updateListParams(event, { filtre: key === 'tous' ? null : key })) filter = key;
	}

	/** Paramètres à conserver dans les liens de tri. */
	const kept = $derived({
		...(filter === 'tous' ? {} : { filtre: filter }),
		...(q.trim() ? { q: q.trim() } : {})
	});
</script>

<svelte:head>
	<title>Livres — TV Time local</title>
</svelte:head>

<LibraryHeader current="livres" counts={data.libraryCounts} />

<LibrarySearch
	bind:value={q}
	placeholder="Titre, série, auteur, éditeur…"
	hidden={filter === 'tous' ? {} : { filtre: filter }}
/>

<div class="scrollbar-none -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
	{#each chips as chip (chip.key)}
		<a
			href={filterHref(chip.key)}
			onclick={(event) => pick(event, chip.key)}
			class="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors
				{filter === chip.key ? 'bg-brand text-brand-ink' : 'bg-card text-mut hover:bg-card-hover hover:text-ink'}"
		>
			{chip.label}
			<span class="opacity-70">· {counts[chip.key]}</span>
		</a>
	{/each}
</div>

<SortToggle base="/livres" bind:sort params={kept} />

{#if books.length === 0}
	<div class="rounded-xl bg-card p-8 text-center text-mut">
		<p class="mb-2 text-3xl">📚</p>
		{#if q.trim()}
			<p>Aucun livre ne correspond à cette recherche.</p>
		{:else if filter === 'tous'}
			<p>Aucun livre pour l'instant. Ajoutez-en via la recherche.</p>
		{:else}
			<p>Aucun livre dans cette catégorie.</p>
		{/if}
	</div>
{:else}
	<div class="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
		{#each books as book (book.id)}
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
