<script lang="ts">
	import Poster from '$lib/components/Poster.svelte';
	import { yearOf } from '$lib/format';

	let { data } = $props();

	const chips = [
		{ key: 'tous', label: 'Tous' },
		{ key: 'avoir', label: 'À voir' },
		{ key: 'vus', label: 'Vus' },
		{ key: 'favoris', label: 'Favoris' }
	];
</script>

<svelte:head>
	<title>Films — TV Time local</title>
</svelte:head>

<h1 class="mb-4 text-2xl font-bold">Films</h1>

<div class="scrollbar-none -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1">
	{#each chips as chip (chip.key)}
		<a
			href="/films{chip.key === 'tous' ? '' : `?filtre=${chip.key}`}"
			data-sveltekit-replacestate
			class="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors
				{data.filter === chip.key ? 'bg-brand text-brand-ink' : 'bg-card text-mut hover:bg-card-hover hover:text-ink'}"
		>
			{chip.label}
			<span class="opacity-70">· {data.counts[chip.key as keyof typeof data.counts]}</span>
		</a>
	{/each}
</div>

{#if data.movies.length === 0}
	<div class="rounded-xl bg-card p-8 text-center text-mut">
		{#if data.filter === 'tous'}
			<p class="mb-1 text-3xl">🎬</p>
			<p>Aucun film pour l'instant. Ajoutez-en via la recherche.</p>
		{:else}
			<p>Aucun film dans cette catégorie.</p>
		{/if}
	</div>
{:else}
	<div class="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4">
		{#each data.movies as movie (movie.id)}
			<a href="/films/{movie.id}" class="group">
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
{/if}
