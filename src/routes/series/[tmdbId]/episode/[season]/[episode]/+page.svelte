<script lang="ts">
	import { enhance } from '$app/forms';
	import BackButton from '$lib/components/BackButton.svelte';
	import CastList from '$lib/components/CastList.svelte';
	import Rating from '$lib/components/Rating.svelte';
	import { formatDateShort, sxe, tmdbImg } from '$lib/format';

	let { data } = $props();
	const ep = $derived(data.episode);
	// Synopsis dévoilé à la demande quand le profil masque les descriptions (anti-spoiler)
	let revealOverview = $state(false);

	const aired = $derived(Boolean(ep.airDate && ep.airDate <= data.today));
	const crewGroups = $derived(
		[
			{ label: 'Réalisation', people: data.directors },
			{ label: 'Scénario', people: data.writers }
		].filter((g) => g.people.length)
	);

	const epHref = (target: { seasonNumber: number; episodeNumber: number }) =>
		`/series/${data.show.tmdbId}/episode/${target.seasonNumber}/${target.episodeNumber}`;
</script>

<svelte:head>
	<title>{ep.name || sxe(ep.seasonNumber, ep.episodeNumber)} · {data.show.name} — TV Time local</title>
</svelte:head>

<div class="relative -mx-4 -mt-5 h-52 sm:h-64 lg:h-80">
	{#if ep.stillPath}
		<img src={tmdbImg(ep.stillPath, 'w780')} alt="" class="h-full w-full object-cover" />
	{:else if data.show.backdropPath}
		<img src={tmdbImg(data.show.backdropPath, 'w780')} alt="" class="h-full w-full object-cover object-top" />
	{:else}
		<div class="h-full w-full bg-card"></div>
	{/if}
	<div class="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent"></div>
	<BackButton
		fallback="/series/{data.show.tmdbId}"
		class="absolute top-3 left-3 flex h-9 w-9 items-center justify-center rounded-full bg-bg/70 text-lg backdrop-blur hover:bg-bg"
	/>
</div>

<div class="relative -mt-10">
	<a href="/series/{data.show.tmdbId}" class="text-sm font-medium text-mut hover:text-brand hover:underline">
		{data.show.name}
	</a>
	<h1 class="mt-0.5 text-xl leading-tight font-bold">
		{ep.name || `Épisode ${ep.episodeNumber}`}
	</h1>
	<p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-mut">
		<span>
			<span class="font-medium text-ink/90">{sxe(ep.seasonNumber, ep.episodeNumber)}</span>
			{#if ep.airDate}· {aired ? 'Diffusé le' : 'Diffusion le'} {formatDateShort(ep.airDate)}{/if}
			{#if ep.runtime}· {ep.runtime} min{/if}
		</span>
		<Rating value={data.voteAverage} />
	</p>
</div>

<div class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
	<form method="POST" action="?/toggle" use:enhance>
		<input type="hidden" name="episodeId" value={ep.id} />
		<button
			class="rounded-full px-4 py-2 text-sm font-semibold {ep.watchCount
				? 'bg-brand text-brand-ink hover:opacity-90'
				: 'border border-line text-mut hover:border-brand hover:text-brand'}"
			title={ep.watchCount ? 'Marquer comme non vu' : 'Marquer comme vu'}
		>
			{ep.watchCount ? `✓ Vu${ep.watchCount > 1 ? ` ${ep.watchCount}×` : ''}` : 'Marquer comme vu'}
		</button>
	</form>
	{#if data.watchDates.length}
		<p class="text-xs text-mut">
			Vu le {data.watchDates.map((d) => formatDateShort(d.slice(0, 10))).join(', le ')}
		</p>
	{/if}
</div>

{#if ep.overview}
	{#if !data.hideEpisodeOverviews || revealOverview}
		<p class="mt-4 text-sm leading-relaxed text-mut">{ep.overview}</p>
	{:else}
		<button
			type="button"
			onclick={() => (revealOverview = true)}
			class="mt-4 rounded-full border border-line px-4 py-2 text-sm text-mut hover:border-mut hover:text-ink"
		>
			Afficher le synopsis
		</button>
	{/if}
{/if}

{#if crewGroups.length}
	<section class="mt-4 space-y-1 text-sm">
		{#each crewGroups as group (group.label)}
			<p>
				<span class="text-mut">{group.label} :</span>
				{#each group.people as person, i (person.id)}{#if i > 0},
					{/if}<a
						href="/personnes/{person.id}"
						class="hover:text-brand hover:underline"
						title="Voir la filmographie de {person.name}">{person.name}</a
					>{/each}
			</p>
		{/each}
	</section>
{/if}

<CastList cast={data.guestStars} title="Guest stars" />

{#if data.prev || data.next}
	<nav class="mt-8 flex items-stretch justify-between gap-3 border-t border-line pt-4">
		{#if data.prev}
			<a href={epHref(data.prev)} class="group min-w-0 flex-1">
				<p class="text-xs text-mut">← Épisode précédent</p>
				<p class="mt-0.5 truncate text-sm font-medium group-hover:text-brand">
					{sxe(data.prev.seasonNumber, data.prev.episodeNumber)}{#if data.prev.name}&nbsp;· {data.prev.name}{/if}
				</p>
			</a>
		{:else}
			<span class="flex-1"></span>
		{/if}
		{#if data.next}
			<a href={epHref(data.next)} class="group min-w-0 flex-1 text-right">
				<p class="text-xs text-mut">Épisode suivant →</p>
				<p class="mt-0.5 truncate text-sm font-medium group-hover:text-brand">
					{sxe(data.next.seasonNumber, data.next.episodeNumber)}{#if data.next.name}&nbsp;· {data.next.name}{/if}
				</p>
			</a>
		{/if}
	</nav>
{/if}
