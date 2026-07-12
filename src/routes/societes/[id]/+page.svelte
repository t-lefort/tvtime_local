<script lang="ts">
	import Poster from '$lib/components/Poster.svelte';
	import { tmdbImg, yearOf } from '$lib/format';

	let { data } = $props();
	const company = $derived(data.company);
</script>

<svelte:head>
	<title>{company.name} — TV Time local</title>
</svelte:head>

<div class="-mt-1 mb-4">
	<button
		type="button"
		onclick={() => history.back()}
		class="flex h-9 w-9 items-center justify-center rounded-full bg-card text-lg text-mut hover:bg-card-hover hover:text-ink"
		aria-label="Retour"
	>
		←
	</button>
</div>

<div class="flex items-center gap-4">
	<div class="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-2 ring-1 ring-line">
		{#if company.logoPath}
			<img src={tmdbImg(company.logoPath, 'w185')} alt={company.name} class="max-h-full max-w-full object-contain" />
		{:else}
			<span class="text-2xl">🏢</span>
		{/if}
	</div>
	<div class="min-w-0">
		<h1 class="text-xl leading-tight font-bold">{company.name}</h1>
		{#if company.headquarters || company.originCountry}
			<p class="mt-1 text-xs text-mut">
				{[company.headquarters, company.originCountry].filter(Boolean).join(' · ')}
			</p>
		{/if}
	</div>
</div>

{#if company.description}
	<p class="mt-4 line-clamp-6 text-sm leading-relaxed text-mut">{company.description}</p>
{/if}

{#if data.movies.length}
	<h2 class="mt-6 mb-3 text-sm font-semibold tracking-wide text-mut uppercase">
		Films ({data.movies.length})
	</h2>
	<ul class="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4">
		{#each data.movies as movie (movie.tmdbId)}
			<li>
				<a href="/films/{movie.tmdbId}" class="group block">
					<div class="relative aspect-[2/3] overflow-hidden rounded-lg bg-card ring-1 ring-line group-hover:ring-brand">
						<Poster path={movie.posterPath} alt={movie.title} size="w342" fallback="🎬" />
						{#if movie.localId}
							<span class="absolute top-1 right-1 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-brand-ink">
								✓
							</span>
						{/if}
					</div>
					<p class="mt-1 line-clamp-2 text-xs font-medium leading-tight group-hover:text-brand">
						{movie.title}
					</p>
					<p class="text-[11px] text-mut">{yearOf(movie.date)}</p>
				</a>
			</li>
		{/each}
	</ul>
{:else}
	<p class="mt-10 text-center text-sm text-mut">Aucun film trouvé pour cette société.</p>
{/if}

<p class="mt-8 text-center text-[11px] text-mut/70">
	Données fournies par <a href="https://www.themoviedb.org" class="underline">TMDB</a>
</p>
