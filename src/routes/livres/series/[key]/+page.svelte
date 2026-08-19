<script lang="ts">
	import { enhance } from '$app/forms';
	import BackButton from '$lib/components/BackButton.svelte';
	import BookBanner from '$lib/components/BookBanner.svelte';
	import BookCover from '$lib/components/BookCover.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import UserRating from '$lib/components/UserRating.svelte';
	import { formatDateShort, yearOf } from '$lib/format';

	let { data, form } = $props();

	let adding = $state<string | null>(null);
	let confirmAll = $state(false);

	const series = $derived(data.series);
	const volumes = $derived(data.volumes);
	/** Vignette de la série : le premier tome dont on ait une couverture. */
	const cover = $derived(volumes.find((volume) => volume.bookId) ?? volumes[0]);
	const missing = $derived(volumes.filter((volume) => volume.bookId === null).length);

	/** Lien d'un tome : sa fiche de bibliothèque, sinon celle du catalogue. */
	function volumeHref(volume: (typeof volumes)[number]): string | null {
		if (volume.bookId) return `/livres/${volume.bookId}`;
		return volume.uri ? `/livres/oeuvre/${encodeURIComponent(volume.uri)}` : null;
	}

	function publishLabel(value: string | null): string | null {
		if (!value) return null;
		return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDateShort(value) : (yearOf(value) || value);
	}
</script>

<svelte:head><title>{series.title} — TV Time local</title></svelte:head>

<!-- Même silhouette que la fiche d'une série télé : un bandeau, l'affiche qui
	 déborde dessus, puis la progression et les actions. -->
<div class="relative -mx-4 -mt-5 h-44 sm:h-56">
	<BookBanner bookId={cover?.bookId ?? null} volumeId={cover?.volumeId ?? null} />
	<BackButton
		fallback="/livres"
		class="absolute top-3 left-3 flex h-9 w-9 items-center justify-center rounded-full bg-bg/70 text-lg backdrop-blur hover:bg-bg"
	/>
</div>

<div class="relative -mt-14 flex items-end gap-4">
	<div class="shrink-0 overflow-hidden rounded-lg shadow-lg ring-1 ring-line" style="width: 6.75rem">
		<div class="aspect-[2/3]">
			<BookCover bookId={cover?.bookId ?? null} volumeId={cover?.volumeId ?? null} alt={series.title} />
		</div>
	</div>
	<div class="min-w-0 flex-1 pb-1">
		<h1 class="text-xl leading-tight font-bold">{series.title}</h1>
		{#if series.authors.length}
			<p class="mt-1 truncate text-sm">{series.authors.join(', ')}</p>
		{/if}
		<p class="mt-0.5 text-sm text-mut">
			Série de livres · {volumes.length} tome{volumes.length > 1 ? 's' : ''}
		</p>
	</div>
</div>

{#if data.ownedCount}
	<div class="mt-4">
		<ProgressBar value={data.readCount} max={data.ownedCount} />
		<p class="mt-1.5 text-sm text-mut">
			{data.readCount}/{data.ownedCount} tome{data.ownedCount > 1 ? 's' : ''} lu{data.readCount > 1 ? 's' : ''}
			dans ma bibliothèque
			{#if missing > 0}
				· <span class="text-ink">{missing} manquant{missing > 1 ? 's' : ''}</span>
			{:else if volumes.length}
				· collection complète ✓
			{/if}
		</p>
	</div>
{:else}
	<p class="mt-4 text-sm text-mut">Aucun tome de cette série dans votre bibliothèque.</p>
{/if}

<div class="mt-4 flex flex-wrap items-center gap-2">
	{#if data.ownedCount > data.readCount}
		<form method="POST" action="?/resume" use:enhance>
			<button class="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:opacity-90">
				▶ Reprendre la lecture
			</button>
		</form>
	{/if}
	{#if data.ownedCount > data.readCount}
		{#if confirmAll}
			<form method="POST" action="?/markAll" use:enhance={() => async ({ update }) => {
				await update();
				confirmAll = false;
			}} class="flex items-center gap-2">
				<button class="rounded-full border border-brand px-3.5 py-2 text-sm font-semibold text-brand">
					Confirmer : tout marquer comme lu
				</button>
				<button type="button" class="text-sm text-mut" onclick={() => (confirmAll = false)}>Annuler</button>
			</form>
		{:else}
			<button
				type="button"
				class="rounded-full border border-line px-3.5 py-2 text-sm font-semibold text-mut hover:border-mut hover:text-ink"
				onclick={() => (confirmAll = true)}
			>
				Tout marquer comme lu
			</button>
		{/if}
	{/if}
	<form method="POST" action="?/refresh" use:enhance>
		<button
			class="rounded-full border border-line px-3.5 py-2 text-sm text-mut hover:border-mut hover:text-ink"
			title="Rafraîchir la liste des tomes et leurs descriptions"
		>
			↻
		</button>
	</form>
</div>

<div class="mt-3">
	<UserRating value={data.userSeries.rating} />
</div>

{#if series.description}
	<p class="mt-4 text-sm leading-relaxed text-mut">{series.description}</p>
{/if}

{#if form?.error}<p class="mt-4 text-sm text-red-400">{form.error}</p>{/if}
{#if form?.ok}<p class="mt-4 text-sm text-ok">{form.ok}</p>{/if}

{#if series.catalogueUnavailable}
	<p class="mt-4 rounded-xl border border-line bg-card p-3 text-sm text-mut">
		La liste complète des tomes n'a pas pu être récupérée. Seuls ceux de votre bibliothèque sont
		affichés.
	</p>
{:else if data.enriching > 0}
	<p class="mt-4 text-xs text-mut">
		Descriptions et couvertures de {data.enriching} tome{data.enriching > 1 ? 's' : ''} en cours de
		récupération — rechargez la page dans un instant.
	</p>
{/if}

{#if volumes.length === 0}
	<div class="mt-5 rounded-xl bg-card p-8 text-center text-mut">
		<p class="mb-2 text-3xl">📚</p>
		<p>Aucun tome connu pour cette série.</p>
	</div>
{:else}
	<!-- Une ligne par tome, dans l'ordre de la série, exactement comme les
		 épisodes d'une saison : le rang à gauche, l'état à droite, tout cliquable. -->
	<ul class="mt-5 divide-y divide-line/60 overflow-hidden rounded-2xl bg-card">
		{#each volumes as volume (volume.key)}
			{@const href = volumeHref(volume)}
			{@const read = volume.readingStatus === 'read'}
			<li class="flex items-center gap-3 p-2.5 {volume.bookId ? '' : 'opacity-70'}">
				<a
					href={href ?? '#'}
					class="h-16 w-11 shrink-0 overflow-hidden rounded-md bg-card-hover"
					tabindex={href ? undefined : -1}
					aria-hidden={href ? undefined : 'true'}
				>
					<BookCover bookId={volume.bookId} volumeId={volume.volumeId} alt={volume.label} />
				</a>
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm">
						<span class="font-semibold {read ? 'text-mut' : ''}">{volume.label}</span>
						{#if volume.title}
							{#if href}
								<a href={href} class="hover:text-brand hover:underline">· {volume.title}</a>
							{:else}
								<span class="text-mut">· {volume.title}</span>
							{/if}
						{/if}
					</p>
					<p class="truncate text-xs text-mut">
						{#if volume.bookId}
							{read ? '✓ Lu' : volume.readingStatus === 'reading' ? '📖 En cours' : 'À lire'}
							{#if volume.wishlist && !volume.inCollection} · Envie{/if}
							{#if volume.favorite} · ⭐{/if}
						{:else}
							Pas dans ma bibliothèque
						{/if}
						{#if publishLabel(volume.date)} · {publishLabel(volume.date)}{/if}
					</p>
				</div>

				{#if volume.bookId}
					{#if !read && volume.ordinal !== null}
						<form method="POST" action="?/readUntil" use:enhance>
							<input type="hidden" name="ordinal" value={volume.ordinal} />
							<button
								class="flex h-8 w-8 items-center justify-center rounded-full text-mut/60 hover:bg-card-hover hover:text-brand"
								title="Marquer comme lu jusqu'ici"
								aria-label="Marquer comme lu jusqu'au {volume.label}"
							>
								<svg viewBox="0 0 24 24" class="h-4.5 w-4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M2 12.5l4.5 4.5L16 7.5" /><path d="M12 16.5l2 1.5L22.5 8.5" />
								</svg>
							</button>
						</form>
					{/if}
					<form method="POST" action="?/toggleRead" use:enhance>
						<input type="hidden" name="bookId" value={volume.bookId} />
						<input type="hidden" name="read" value={read ? '0' : '1'} />
						<button
							class="flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors {read
								? 'border-brand bg-brand text-brand-ink'
								: 'border-line text-mut hover:border-brand hover:text-brand'}"
							title={read ? 'Marquer comme non lu' : 'Marquer comme lu'}
							aria-label="{read ? 'Marquer comme non lu' : 'Marquer comme lu'} : {volume.label}"
						>
							<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
								<path d="M4 12.5l5 5L20 6.5" />
							</svg>
						</button>
					</form>
				{:else if volume.sourceId}
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
						<input type="hidden" name="sourceId" value={volume.sourceId} />
						<button
							disabled={adding !== null}
							class="shrink-0 rounded-full border border-line px-3 py-1.5 text-sm font-semibold text-mut hover:border-brand hover:text-brand disabled:opacity-50"
						>
							{adding === volume.key ? 'Ajout…' : '+'}
						</button>
					</form>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<section class="mt-6 rounded-2xl bg-card p-4">
	<h2 class="mb-2 text-sm font-semibold">Mon avis sur la série</h2>
	<form method="POST" action="?/review" use:enhance class="flex flex-col gap-2">
		<textarea
			name="review"
			rows="3"
			placeholder="Ce que j'en ai pensé…"
			class="w-full resize-y rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-mut focus:border-brand focus:outline-none"
			>{data.userSeries.review ?? ''}</textarea
		>
		<button class="self-end rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:opacity-90">
			Enregistrer
		</button>
	</form>
</section>
