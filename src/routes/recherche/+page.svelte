<script lang="ts">
	import { enhance } from '$app/forms';
	import Poster from '$lib/components/Poster.svelte';
	import { yearOf } from '$lib/format';

	let { data } = $props();
	let adding = $state<number | null>(null);
</script>

<svelte:head>
	<title>Recherche — TV Time local</title>
</svelte:head>

<h1 class="mb-4 text-2xl font-bold">Recherche</h1>

<form method="GET" class="mb-5">
	<input
		type="search"
		name="q"
		value={data.q}
		placeholder="Nom d'une série…"
		autocomplete="off"
		class="w-full rounded-xl border border-line bg-card px-4 py-3 text-ink placeholder:text-mut focus:border-brand focus:outline-none"
	/>
</form>

{#if data.error}
	<div class="rounded-xl border border-red-400/30 bg-card p-5 text-center text-sm text-red-300">
		<p>{data.error}</p>
	</div>
{:else if data.q && data.results.length === 0}
	<div class="rounded-xl bg-card p-8 text-center text-mut">
		<p>Aucun résultat pour « {data.q} ».</p>
	</div>
{:else if data.results.length}
	<ul class="space-y-2">
		{#each data.results as result (result.tmdbId)}
			<li class="flex items-center gap-3 rounded-xl bg-card p-2 pr-3">
				<div class="h-21 w-14 shrink-0 overflow-hidden rounded-md" style="height: 5.25rem">
					<Poster path={result.posterPath} alt={result.name} size="w185" />
				</div>
				<div class="min-w-0 flex-1 py-1">
					<p class="truncate font-semibold">
						{result.name}
						{#if yearOf(result.firstAirDate)}<span class="font-normal text-mut"> ({yearOf(result.firstAirDate)})</span>{/if}
					</p>
					{#if result.originalName !== result.name}
						<p class="truncate text-xs text-mut">{result.originalName}</p>
					{/if}
					{#if result.overview}
						<p class="mt-0.5 line-clamp-2 text-xs text-mut">{result.overview}</p>
					{/if}
				</div>
				{#if result.localId}
					<a
						href="/series/{result.localId}"
						class="shrink-0 rounded-full border border-brand px-3.5 py-1.5 text-sm font-semibold text-brand"
					>
						Voir
					</a>
				{:else}
					<form
						method="POST"
						action="?/add"
						use:enhance={() => {
							adding = result.tmdbId;
							return async ({ update }) => {
								await update();
								adding = null;
							};
						}}
					>
						<input type="hidden" name="tmdbId" value={result.tmdbId} />
						<button
							disabled={adding !== null}
							class="shrink-0 rounded-full bg-brand px-3.5 py-1.5 text-sm font-semibold text-brand-ink hover:opacity-90 disabled:opacity-50"
						>
							{adding === result.tmdbId ? 'Ajout…' : '+ Suivre'}
						</button>
					</form>
				{/if}
			</li>
		{/each}
	</ul>
{:else}
	<p class="mt-10 text-center text-sm text-mut">
		Cherchez une série pour l'ajouter à votre bibliothèque.
	</p>
{/if}

<p class="mt-8 text-center text-[11px] text-mut/70">
	Données fournies par <a href="https://www.themoviedb.org" class="underline">TMDB</a>
</p>
