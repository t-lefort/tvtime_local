<script lang="ts">
	import Poster from '$lib/components/Poster.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';

	let { data } = $props();

	const chips = [
		{ key: 'toutes', label: 'Toutes' },
		{ key: 'encours', label: 'En cours' },
		{ key: 'ajour', label: 'À jour' },
		{ key: 'pascommencees', label: 'Pas commencées' },
		{ key: 'terminees', label: 'Terminées' },
		{ key: 'arretees', label: 'Arrêtées' }
	];
</script>

<svelte:head>
	<title>Séries — TV Time local</title>
</svelte:head>

<h1 class="mb-4 text-2xl font-bold">Séries</h1>

<div class="scrollbar-none -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1">
	{#each chips as chip (chip.key)}
		<a
			href="/series{chip.key === 'toutes' ? '' : `?filtre=${chip.key}`}"
			data-sveltekit-replacestate
			class="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors
				{data.filter === chip.key ? 'bg-brand text-brand-ink' : 'bg-card text-mut hover:bg-card-hover hover:text-ink'}"
		>
			{chip.label}
			{#if data.counts[chip.key] !== undefined}<span class="opacity-70">· {data.counts[chip.key]}</span>{/if}
		</a>
	{/each}
</div>

{#if data.shows.length === 0}
	<div class="rounded-xl bg-card p-8 text-center text-mut">
		<p>Aucune série dans cette catégorie.</p>
	</div>
{:else}
	<div class="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4">
		{#each data.shows as show (show.id)}
			<a href="/series/{show.id}" class="group">
				<div class="relative aspect-[2/3] overflow-hidden rounded-lg bg-card shadow-md">
					<div class="h-full w-full {show.state === 'stopped' ? 'opacity-40 grayscale' : ''}">
						<Poster path={show.posterPath} alt={show.name} size="w342" />
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
