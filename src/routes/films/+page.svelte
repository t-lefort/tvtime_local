<script lang="ts">
	import LibraryHeader from '$lib/components/LibraryHeader.svelte';
	import LibrarySearch from '$lib/components/LibrarySearch.svelte';
	import Poster from '$lib/components/Poster.svelte';
	import SortToggle from '$lib/components/SortToggle.svelte';
	import { yearOf } from '$lib/format';
	import { DEFAULT_SORT } from '$lib/sort';

	let { data } = $props();

	/** Conserve l'ordre et la recherche courants en changeant de filtre. */
	function filterHref(key: string) {
		const params = new URLSearchParams();
		if (key !== 'tous') params.set('filtre', key);
		if (data.sort !== DEFAULT_SORT) params.set('tri', data.sort);
		if (data.q) params.set('q', data.q);
		const query = params.toString();
		return query ? `/films?${query}` : '/films';
	}

	/** Paramètres à conserver dans les liens de tri et le champ de recherche. */
	const kept = $derived({
		...(data.filter === 'tous' ? {} : { filtre: data.filter }),
		...(data.q ? { q: data.q } : {})
	});

	const chips = [
		{ key: 'tous', label: 'Tous' },
		{ key: 'avoir', label: 'À voir' },
		{ key: 'vus', label: 'Vus' },
		{ key: 'favoris', label: 'Favoris' }
	];

	const aVoir = $derived(data.movies.filter((m) => m.watchCount === 0));
	const vus = $derived(data.movies.filter((m) => m.watchCount > 0));
</script>

<svelte:head>
	<title>Films — TV Time local</title>
</svelte:head>

<LibraryHeader current="films" counts={data.libraryCounts} />

<LibrarySearch
	value={data.q}
	placeholder="Titre d'un film…"
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

<SortToggle base="/films" sort={data.sort} params={kept} />

{#if data.movies.length === 0}
	<div class="rounded-xl bg-card p-8 text-center text-mut">
		<p class="mb-2 text-3xl">🎬</p>
		{#if data.q}
			<p>Aucun film ne correspond à cette recherche.</p>
		{:else if data.filter === 'tous'}
			<p>Aucun film pour l'instant. Ajoutez-en via la recherche.</p>
		{:else}
			<p>Aucun film dans cette catégorie.</p>
		{/if}
	</div>
{:else}
	{#snippet grid(movies: typeof data.movies)}
		<div class="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
			{#each movies as movie (movie.id)}
				<a href="/films/{movie.tmdbId}" class="group">
					<div class="relative aspect-[2/3] overflow-hidden rounded-lg bg-card shadow-md">
						<Poster path={movie.posterPath} alt={movie.title} size="w342" fallback="🎬" />
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
