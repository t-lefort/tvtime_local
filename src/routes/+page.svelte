<script lang="ts">
	import { enhance } from '$app/forms';
	import Poster from '$lib/components/Poster.svelte';
	import { dayLabel, daysUntil, formatDateShort, sxe, tmdbImg } from '$lib/format';
	import type { UpcomingItem } from '$lib/server/queries';

	let { data } = $props();

	let tab: 'avoir' | 'avenir' = $state('avoir');

	const upcomingGroups = $derived.by(() => {
		const groups = new Map<string, UpcomingItem[]>();
		for (const ep of data.upcoming) {
			const list = groups.get(ep.airDate) ?? [];
			list.push(ep);
			groups.set(ep.airDate, list);
		}
		return [...groups.entries()];
	});
</script>

<svelte:head>
	<title>Fil — TV Time local</title>
</svelte:head>

<h1 class="mb-4 text-2xl font-bold">Fil</h1>

<div class="mb-5 flex border-b border-line" role="tablist">
	<button
		role="tab"
		aria-selected={tab === 'avoir'}
		class="flex-1 border-b-2 pb-2.5 text-sm font-semibold transition-colors sm:flex-none sm:px-8
			{tab === 'avoir' ? 'border-brand text-brand' : 'border-transparent text-mut'}"
		onclick={() => (tab = 'avoir')}
	>
		À voir {#if data.watchNext.length}<span class="ml-1 rounded-full bg-card px-2 py-0.5 text-xs">{data.watchNext.length}</span>{/if}
	</button>
	<button
		role="tab"
		aria-selected={tab === 'avenir'}
		class="flex-1 border-b-2 pb-2.5 text-sm font-semibold transition-colors sm:flex-none sm:px-8
			{tab === 'avenir' ? 'border-brand text-brand' : 'border-transparent text-mut'}"
		onclick={() => (tab = 'avenir')}
	>
		À venir
	</button>
</div>

{#if tab === 'avoir'}
	{#if data.watchNext.length === 0}
		<div class="rounded-xl bg-card p-8 text-center text-mut">
			<p class="mb-1 text-3xl">🎉</p>
			<p>Tout est vu ! Ajoutez une série via la recherche.</p>
		</div>
	{:else}
		<ul class="space-y-3">
			{#each data.watchNext as item (item.showId)}
				<li class="flex items-stretch overflow-hidden rounded-xl bg-card">
					<a href="/series/{item.showTmdbId}" class="flex min-w-0 flex-1 items-center gap-3 md:gap-5">
						<div class="h-20 w-32 shrink-0 self-stretch md:h-auto md:min-h-28 md:w-48">
							{#if item.stillPath}
								<img
									src={tmdbImg(item.stillPath, 'w342')}
									alt=""
									loading="lazy"
									class="h-full w-full object-cover"
								/>
							{:else}
								<div class="h-full w-full">
									<Poster path={item.posterPath} size="w185" />
								</div>
							{/if}
						</div>
						<div class="min-w-0 flex-1 py-2 md:py-3">
							<p class="truncate font-semibold md:text-lg">{item.showName}</p>
							<p class="truncate text-sm text-mut">
								<span class="font-medium text-ink/90">{sxe(item.seasonNumber, item.episodeNumber)}</span>
								{#if item.episodeName}· {item.episodeName}{/if}
							</p>
							{#if item.remaining > 1}
								<p class="mt-0.5 text-xs text-mut md:hidden">{item.remaining} épisodes à voir</p>
							{/if}
							<p class="mt-1 hidden gap-x-4 text-xs text-mut md:flex md:flex-wrap">
								{#if item.airDate}<span>Diffusé le {formatDateShort(item.airDate)}</span>{/if}
								{#if item.runtime}<span>{item.runtime} min</span>{/if}
								{#if item.remaining > 1}<span>{item.remaining} épisodes à voir</span>{/if}
							</p>
							{#if item.episodeOverview && !data.hideEpisodeOverviews}
								<p class="mt-1.5 hidden text-sm text-mut md:line-clamp-2">{item.episodeOverview}</p>
							{/if}
						</div>
					</a>
					<form method="POST" action="?/watch" use:enhance class="flex items-center pr-3 md:pr-5">
						<input type="hidden" name="episodeId" value={item.episodeId} />
						<button
							class="flex h-11 w-11 items-center justify-center rounded-full border-2 border-line text-mut transition-colors hover:border-brand hover:bg-brand hover:text-brand-ink"
							title="Marquer comme vu"
							aria-label="Marquer {sxe(item.seasonNumber, item.episodeNumber)} de {item.showName} comme vu"
						>
							<svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
								<path d="M4 12.5l5 5L20 6.5" />
							</svg>
						</button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}
{:else if upcomingGroups.length === 0}
	<div class="rounded-xl bg-card p-8 text-center text-mut">
		<p class="mb-1 text-3xl">📅</p>
		<p>Aucun épisode annoncé pour vos séries.</p>
	</div>
{:else}
	<div class="space-y-6">
		{#each upcomingGroups as [date, eps] (date)}
			<section>
				<h2 class="mb-2 flex items-baseline gap-2 text-sm font-semibold tracking-wide text-brand uppercase">
					{dayLabel(date)}
					<span class="text-xs font-normal text-mut normal-case">
						{daysUntil(date) === 1 ? '' : `dans ${daysUntil(date)} jours`}
					</span>
				</h2>
				<ul class="space-y-2">
					{#each eps as ep (ep.episodeId)}
						<li>
							<a href="/series/{ep.showTmdbId}" class="flex items-center gap-3 rounded-xl bg-card p-2 pr-4 transition-colors hover:bg-card-hover md:gap-4 md:p-3 md:pr-5">
								<div class="h-14 w-10 shrink-0 overflow-hidden rounded-md md:h-16 md:w-11">
									<Poster path={ep.posterPath} size="w185" />
								</div>
								<div class="min-w-0 flex-1">
									<p class="truncate font-semibold">{ep.showName}</p>
									<p class="truncate text-sm text-mut">
										<span class="font-medium text-ink/90">{sxe(ep.seasonNumber, ep.episodeNumber)}</span>
										{#if ep.episodeName}· {ep.episodeName}{/if}
									</p>
									{#if ep.episodeOverview && !data.hideEpisodeOverviews}
										<p class="mt-0.5 hidden text-sm text-mut md:line-clamp-1">{ep.episodeOverview}</p>
									{/if}
								</div>
								{#if ep.runtime}
									<span class="hidden shrink-0 text-xs text-mut md:block">{ep.runtime} min</span>
								{/if}
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>
{/if}
