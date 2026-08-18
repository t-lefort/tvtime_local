<script lang="ts">
	import LibraryHeader from '$lib/components/LibraryHeader.svelte';
	import LibrarySearch from '$lib/components/LibrarySearch.svelte';
	import Poster from '$lib/components/Poster.svelte';
	import SortToggle from '$lib/components/SortToggle.svelte';
	import { yearOf } from '$lib/format';
	import { matchesQuery, parseQuery } from '$lib/library';
	import { updateListParams } from '$lib/library-nav';
	import { DEFAULT_SORT, type SortOrder } from '$lib/sort';

	let { data } = $props();

	type Movie = (typeof data.movies)[number];

	const chips = [
		{ key: 'tous', label: 'Tous', match: () => true },
		{ key: 'avoir', label: 'À voir', match: (m: Movie) => m.watchCount === 0 },
		{ key: 'vus', label: 'Vus', match: (m: Movie) => m.watchCount > 0 },
		{ key: 'favoris', label: 'Favoris', match: (m: Movie) => m.favorite }
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
		[...data.movies].sort((a, b) =>
			sort === 'alpha'
				? a.title.localeCompare(b.title, 'fr')
				: // Activité la plus récente d'abord (dernier visionnage, sinon date d'ajout)
					(b.lastWatchedAt ?? b.addedAt).localeCompare(a.lastWatchedAt ?? a.addedAt)
		)
	);

	const needle = $derived(parseQuery(q).needle);
	const matching = $derived(sorted.filter((m) => matchesQuery(needle, [m.title, m.originalTitle])));

	// Les compteurs portent sur le résultat de la recherche : les puces disent
	// combien de titres restent dans chaque catégorie.
	const counts = $derived(
		Object.fromEntries(chips.map((chip) => [chip.key, matching.filter(chip.match).length]))
	);

	const movies = $derived(matching.filter(chips.find((chip) => chip.key === filter)?.match ?? (() => true)));

	const aVoir = $derived(movies.filter((m) => m.watchCount === 0));
	const vus = $derived(movies.filter((m) => m.watchCount > 0));

	/** Conserve l'ordre et la recherche courants en changeant de filtre. */
	function filterHref(key: string) {
		const params = new URLSearchParams();
		if (key !== 'tous') params.set('filtre', key);
		if (sort !== DEFAULT_SORT) params.set('tri', sort);
		if (q.trim()) params.set('q', q.trim());
		const query = params.toString();
		return query ? `/films?${query}` : '/films';
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
	<title>Films — TV Time local</title>
</svelte:head>

<LibraryHeader current="films" counts={data.libraryCounts} />

<LibrarySearch
	bind:value={q}
	placeholder="Titre d'un film…"
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

<SortToggle base="/films" bind:sort params={kept} />

{#if movies.length === 0}
	<div class="rounded-xl bg-card p-8 text-center text-mut">
		<p class="mb-2 text-3xl">🎬</p>
		{#if q.trim()}
			<p>Aucun film ne correspond à cette recherche.</p>
		{:else if filter === 'tous'}
			<p>Aucun film pour l'instant. Ajoutez-en via la recherche.</p>
		{:else}
			<p>Aucun film dans cette catégorie.</p>
		{/if}
	</div>
{:else}
	{#snippet grid(list: Movie[])}
		<div class="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
			{#each list as movie (movie.id)}
				<a href="/films/{movie.tmdbId}" class="group">
					<div class="relative aspect-[2/3] overflow-hidden rounded-lg bg-card shadow-md">
						<Poster path={movie.posterPath} alt={movie.title} size="w342" fallback="🎬" grid />
						{#if movie.favorite}
							<span class="absolute top-1.5 right-1.5 rounded-full bg-bg/70 px-1.5 py-0.5 text-xs">⭐</span>
						{/if}
						{#if movie.watchCount > 0}
							<span
								class="absolute bottom-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-brand-ink"
								title="Vu"
							>
								<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
									<path d="M4 12.5l5 5L20 6.5" />
								</svg>
							</span>
						{/if}
					</div>
					<p class="mt-1.5 truncate text-sm font-medium group-hover:text-brand">{movie.title}</p>
					<p class="text-xs text-mut">{yearOf(movie.releaseDate)}</p>
				</a>
			{/each}
		</div>
	{/snippet}

	{#if aVoir.length > 0}
		<section class="mb-8">
			<h2 class="mb-3 text-lg font-semibold">À voir <span class="text-mut">· {aVoir.length}</span></h2>
			{@render grid(aVoir)}
		</section>
	{/if}
	{#if vus.length > 0}
		<section class="mb-8">
			<h2 class="mb-3 text-lg font-semibold">Vus <span class="text-mut">· {vus.length}</span></h2>
			{@render grid(vus)}
		</section>
	{/if}
{/if}
