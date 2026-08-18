<script lang="ts">
	import LibraryHeader from '$lib/components/LibraryHeader.svelte';
	import LibrarySearch from '$lib/components/LibrarySearch.svelte';
	import Poster from '$lib/components/Poster.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import SortToggle from '$lib/components/SortToggle.svelte';
	import { matchesQuery, parseQuery } from '$lib/library';
	import { updateListParams } from '$lib/library-nav';
	import { DEFAULT_SORT, type SortOrder } from '$lib/sort';

	let { data } = $props();

	type Show = (typeof data.shows)[number];

	const chips = [
		{ key: 'toutes', label: 'Toutes', match: () => true },
		{ key: 'encours', label: 'En cours', match: (s: Show) => s.state === 'watching' },
		{ key: 'ajour', label: 'À jour', match: (s: Show) => s.state === 'uptodate' },
		{ key: 'pascommencees', label: 'Pas commencées', match: (s: Show) => s.state === 'notstarted' },
		{ key: 'terminees', label: 'Terminées', match: (s: Show) => s.state === 'finished' },
		{ key: 'arretees', label: 'Arrêtées', match: (s: Show) => s.state === 'stopped' }
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
		[...data.shows].sort((a, b) => {
			if (sort === 'alpha') return a.name.localeCompare(b.name, 'fr');
			// Les plus récemment regardées d'abord, puis alphabétique
			if (a.lastWatchedAt && b.lastWatchedAt) return b.lastWatchedAt.localeCompare(a.lastWatchedAt);
			if (a.lastWatchedAt) return -1;
			if (b.lastWatchedAt) return 1;
			return a.name.localeCompare(b.name, 'fr');
		})
	);

	const needle = $derived(parseQuery(q).needle);
	const matching = $derived(sorted.filter((s) => matchesQuery(needle, [s.name, s.originalName])));

	// Les compteurs portent sur le résultat de la recherche : les puces disent
	// combien de titres restent dans chaque catégorie.
	const counts = $derived(
		Object.fromEntries(chips.map((chip) => [chip.key, matching.filter(chip.match).length]))
	);

	const shows = $derived(matching.filter(chips.find((chip) => chip.key === filter)?.match ?? (() => true)));

	/** Conserve l'ordre et la recherche courants en changeant de filtre. */
	function filterHref(key: string) {
		const params = new URLSearchParams();
		if (key !== 'toutes') params.set('filtre', key);
		if (sort !== DEFAULT_SORT) params.set('tri', sort);
		if (q.trim()) params.set('q', q.trim());
		const query = params.toString();
		return query ? `/series?${query}` : '/series';
	}

	function pick(event: MouseEvent, key: string) {
		if (updateListParams(event, { filtre: key === 'toutes' ? null : key })) filter = key;
	}

	/** Paramètres à conserver dans les liens de tri. */
	const kept = $derived({
		...(filter === 'toutes' ? {} : { filtre: filter }),
		...(q.trim() ? { q: q.trim() } : {})
	});
</script>

<svelte:head>
	<title>Séries — TV Time local</title>
</svelte:head>

<LibraryHeader current="series" counts={data.libraryCounts} />

<LibrarySearch
	bind:value={q}
	placeholder="Titre d'une série…"
	hidden={filter === 'toutes' ? {} : { filtre: filter }}
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

<SortToggle base="/series" bind:sort params={kept} />

{#if shows.length === 0}
	<div class="rounded-xl bg-card p-8 text-center text-mut">
		<p class="mb-2 text-3xl">📺</p>
		<p>{q.trim() ? 'Aucune série ne correspond à cette recherche.' : 'Aucune série dans cette catégorie.'}</p>
	</div>
{:else}
	<div class="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
		{#each shows as show (show.id)}
			<a href="/series/{show.tmdbId}" class="group">
				<div class="relative aspect-[2/3] overflow-hidden rounded-lg bg-card shadow-md">
					<div class="h-full w-full {show.state === 'stopped' ? 'opacity-40 grayscale' : ''}">
						<Poster path={show.posterPath} alt={show.name} size="w342" grid />
					</div>
					{#if show.favorite}
						<span class="absolute top-1.5 right-1.5 rounded-full bg-bg/70 px-1.5 py-0.5 text-xs">⭐</span>
					{/if}
					{#if show.state === 'stopped'}
						<span class="absolute top-1.5 left-1.5 rounded bg-bg/80 px-1.5 py-0.5 text-[10px] font-semibold text-mut uppercase">Arrêtée</span>
					{/if}
					{#if show.watchedCount > 0}
						<div class="absolute inset-x-0 bottom-0">
							<ProgressBar value={show.watchedCount} max={show.airedCount} />
						</div>
					{/if}
				</div>
				<p class="mt-1.5 truncate text-sm font-medium group-hover:text-brand">{show.name}</p>
				<p class="text-xs text-mut">
					{#if show.state === 'notstarted'}
						{show.airedCount} épisodes
					{:else}
						{show.watchedCount}/{show.airedCount}
					{/if}
				</p>
			</a>
		{/each}
	</div>
{/if}
