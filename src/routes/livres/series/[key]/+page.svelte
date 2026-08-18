<script lang="ts">
	import { enhance } from '$app/forms';
	import BackButton from '$lib/components/BackButton.svelte';
	import { yearOf } from '$lib/format';

	let { data, form } = $props();

	let adding = $state<string | null>(null);

	const series = $derived(data.series);
	const owned = $derived(data.volumes.filter((volume) => volume.bookId !== null));

	/** Lien d'un tome : sa fiche de bibliothèque, sinon celle du catalogue. */
	function volumeHref(volume: (typeof data.volumes)[number]): string | null {
		if (volume.bookId) return `/livres/${volume.bookId}`;
		return volume.uri ? `/livres/oeuvre/${encodeURIComponent(volume.uri)}` : null;
	}

	const STATUS_LABELS: Record<string, string> = {
		read: '✓ Lu',
		reading: '📖 En cours',
		unread: 'À lire'
	};
</script>

<svelte:head><title>{series.title} — TV Time local</title></svelte:head>

<BackButton fallback="/livres" class="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-card text-lg" />

<h1 class="text-2xl font-bold">{series.title}</h1>
<p class="mt-1 text-sm text-mut">
	Série de livres · {data.volumes.length} tome{data.volumes.length > 1 ? 's' : ''}
	{#if data.ownedCount}· {data.ownedCount} dans ma bibliothèque{/if}
	{#if data.readCount}· {data.readCount} lu{data.readCount > 1 ? 's' : ''}{/if}
</p>
{#if series.description}
	<p class="mt-3 text-sm leading-relaxed text-mut">{series.description}</p>
{/if}

{#if form?.error}<p class="mt-4 text-sm text-red-400">{form.error}</p>{/if}

{#if series.catalogueUnavailable}
	<p class="mt-4 rounded-xl border border-line bg-card p-3 text-sm text-mut">
		La liste complète des tomes n'a pas pu être récupérée. Seuls ceux de votre bibliothèque sont affichés.
	</p>
{/if}

{#if data.volumes.length === 0}
	<div class="mt-5 rounded-xl bg-card p-8 text-center text-mut">
		<p class="mb-2 text-3xl">📚</p>
		<p>Aucun tome connu pour cette série.</p>
	</div>
{:else}
	<!-- Une ligne par tome, dans l'ordre de la série, comme les épisodes d'une
		 saison : le numéro à gauche, l'état à droite, et tout est cliquable. -->
	<ul class="mt-5 divide-y divide-line overflow-hidden rounded-2xl bg-card">
		{#each data.volumes as volume (volume.key)}
			{@const href = volumeHref(volume)}
			<li class="flex items-center gap-3 p-3">
				<span
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold
						{volume.bookId ? 'bg-brand/15 text-brand' : 'bg-card-hover text-mut'}"
				>
					{volume.volume ?? '–'}
				</span>
				<div class="min-w-0 flex-1">
					{#if href}
						<a {href} class="block truncate font-medium hover:text-brand hover:underline">{volume.title}</a>
					{:else}
						<p class="truncate font-medium">{volume.title}</p>
					{/if}
					<p class="truncate text-xs text-mut">
						{#if volume.bookId}
							{STATUS_LABELS[volume.readingStatus ?? 'unread']}
							{#if !volume.inCollection} · Envie{/if}
							{#if volume.favorite} · ⭐{/if}
						{:else}
							Pas dans ma bibliothèque
						{/if}
						{#if yearOf(volume.date)} · {yearOf(volume.date)}{/if}
					</p>
				</div>
				{#if !volume.bookId && volume.uri}
					<form
						method="POST"
						action="?/add"
						use:enhance={() => {
							adding = volume.key;
							return async ({ update }) => {
								await update();
								adding = null;
							};
						}}
					>
						<input type="hidden" name="sourceId" value={volume.uri} />
						<button
							disabled={adding !== null}
							class="shrink-0 rounded-full bg-brand px-3.5 py-1.5 text-sm font-semibold text-brand-ink hover:opacity-90 disabled:opacity-50"
						>
							{adding === volume.key ? 'Ajout…' : '+ Ajouter'}
						</button>
					</form>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

{#if owned.length === 0 && series.uri}
	<p class="mt-4 text-center text-xs text-mut">
		Ajoutez un tome pour que la série rejoigne votre bibliothèque.
	</p>
{/if}
