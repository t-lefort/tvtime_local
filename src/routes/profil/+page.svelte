<script lang="ts">
	import { enhance } from '$app/forms';
	import Poster from '$lib/components/Poster.svelte';
	import { formatDuration, formatMonth } from '$lib/format';

	let { data, form } = $props();
	let importFile = $state<FileList | null>(null);
	let importing = $state(false);
	let avatarFile = $state<FileList | null>(null);
	// Force le rechargement de l'image après un envoi (l'URL ne change pas sinon)
	let avatarBump = $state(0);

	/**
	 * Image réduite côté navigateur avant l'envoi : l'avatar est affiché en ~64 px,
	 * inutile d'envoyer une photo de plusieurs Mo (et le serveur Node limite la
	 * taille des requêtes, BODY_SIZE_LIMIT). Recadrée carrée, 256 px, JPEG.
	 */
	let avatarResized = $state<Blob | null>(null);
	const AVATAR_SIZE = 256;

	async function prepareAvatar() {
		avatarResized = null;
		const file = avatarFile?.[0];
		if (!file) return;
		try {
			const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
			const side = Math.min(bitmap.width, bitmap.height);
			const canvas = document.createElement('canvas');
			canvas.width = canvas.height = Math.min(AVATAR_SIZE, side);
			const ctx = canvas.getContext('2d');
			if (!ctx) return;
			ctx.drawImage(
				bitmap,
				(bitmap.width - side) / 2,
				(bitmap.height - side) / 2,
				side,
				side,
				0,
				0,
				canvas.width,
				canvas.height
			);
			bitmap.close();
			avatarResized = await new Promise<Blob | null>((resolve) =>
				canvas.toBlob(resolve, 'image/jpeg', 0.85)
			);
		} catch {
			// Format que le navigateur ne sait pas décoder : le fichier partira tel quel,
			// les contrôles serveur (type, 2 Mo max) s'appliquent
		}
	}

	const maxMonth = $derived(Math.max(1, ...data.months.map((m) => m.count)));
	const maxGenre = $derived(Math.max(1, ...data.perGenre.map((g) => g.minutes)));

	const stateChips = $derived([
		{ label: 'En cours', value: data.countsByState.watching },
		{ label: 'À jour', value: data.countsByState.uptodate },
		{ label: 'Terminées', value: data.countsByState.finished },
		{ label: 'Arrêtées', value: data.countsByState.stopped },
		{ label: 'Pas commencées', value: data.countsByState.notstarted }
	]);

	const hours = (min: number) => `${Math.round(min / 60)} h`;

	const rewatches = $derived(
		data.totalWatches - data.distinctEpisodes + data.totalMovieWatches - data.distinctMovies
	);
</script>

<svelte:head>
	<title>Profil — TV Time local</title>
</svelte:head>

<div class="mb-4 flex items-center justify-between">
	<h1 class="text-2xl font-bold">{data.profileName}</h1>
	<div class="flex items-center gap-4">
		<a href="/profils" class="text-sm text-mut hover:text-ink">Changer de profil</a>
		{#if data.authEnabled}
			<form method="POST" action="?/logout" use:enhance>
				<button class="text-sm text-mut hover:text-ink">Se déconnecter</button>
			</form>
		{/if}
	</div>
</div>

<section class="rounded-2xl bg-card p-5 text-center">
	<p class="text-xs font-semibold tracking-widest text-mut uppercase">Temps devant l'écran</p>
	<p class="mt-1 text-3xl font-extrabold">{formatDuration(data.totalMinutes)}</p>
	{#if data.movieMinutes > 0}
		<p class="mt-1 text-xs text-mut">
			Séries : {formatDuration(data.seriesMinutes)} · Films : {formatDuration(data.movieMinutes)}
		</p>
	{/if}
	<p class="mt-2 text-sm text-mut">
		{data.distinctEpisodes.toLocaleString('fr-FR')} épisodes ·
		{data.totalShows} séries{#if data.distinctMovies > 0}
			· {data.distinctMovies.toLocaleString('fr-FR')} film{data.distinctMovies > 1 ? 's' : ''}{/if}{#if rewatches > 0}
			· {rewatches.toLocaleString('fr-FR')} revisionnages{/if}
	</p>
</section>

<section class="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
	{#each stateChips as chip (chip.label)}
		<div class="rounded-xl bg-card px-2 py-3 text-center">
			<p class="text-lg font-bold">{chip.value}</p>
			<p class="text-[11px] text-mut">{chip.label}</p>
		</div>
	{/each}
</section>

<section class="mt-6">
	<h2 class="mb-3 text-sm font-semibold tracking-wide text-mut uppercase">Épisodes vus par mois</h2>
	<div class="rounded-2xl bg-card p-4">
		<div class="flex h-32 items-end gap-[2px]">
			{#each data.months as m (m.month)}
				<div class="group relative flex h-full flex-1 items-end">
					<div
						class="w-full rounded-t bg-brand transition-opacity group-hover:opacity-80"
						style="height: {m.count === 0 ? '0' : Math.max(3, (m.count / maxMonth) * 100) + '%'}"
					></div>
					<span
						class="pointer-events-none absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 rounded-md bg-bg px-2 py-1 text-[11px] whitespace-nowrap text-ink ring-1 ring-line group-hover:block"
					>
						{formatMonth(m.month)} · {m.count}
					</span>
				</div>
			{/each}
		</div>
		<div class="mt-2 flex gap-[2px] text-[10px] text-mut">
			{#each data.months as m, i (m.month)}
				<span class="flex-1 truncate text-center">{i % 4 === 0 ? formatMonth(m.month) : ''}</span>
			{/each}
		</div>
	</div>
</section>

{#if data.perGenre.length}
	<section class="mt-6">
		<h2 class="mb-3 text-sm font-semibold tracking-wide text-mut uppercase">Par genre</h2>
		<div class="space-y-2.5 rounded-2xl bg-card p-4">
			{#each data.perGenre as g (g.genre)}
				<div class="flex items-center gap-3">
					<span class="w-32 shrink-0 truncate text-sm">{g.genre}</span>
					<div class="h-2 flex-1 overflow-hidden rounded-full bg-line/60">
						<div class="h-full rounded-full bg-brand" style="width: {(g.minutes / maxGenre) * 100}%"></div>
					</div>
					<span class="w-14 shrink-0 text-right text-xs text-mut tabular-nums">{hours(g.minutes)}</span>
				</div>
			{/each}
		</div>
	</section>
{/if}

<section class="mt-6">
	<h2 class="mb-3 text-sm font-semibold tracking-wide text-mut uppercase">Profil</h2>
	<div class="space-y-4 rounded-2xl bg-card p-4">
		<form
			method="POST"
			action="?/avatar"
			enctype="multipart/form-data"
			use:enhance={({ formData }) => {
				if (avatarResized) formData.set('avatar', avatarResized, 'avatar.jpg');
				return async ({ update }) => {
					await update();
					avatarBump++;
					avatarFile = null;
					avatarResized = null;
				};
			}}
			class="flex flex-wrap items-center gap-3"
		>
			{#if data.hasAvatar}
				<img
					src="/profils/{data.profileId}/avatar?v={avatarBump}"
					alt=""
					class="h-14 w-14 shrink-0 rounded-full object-cover"
				/>
			{:else}
				<span class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-line/60 text-xl font-bold">
					{data.profileName.trim().charAt(0).toUpperCase()}
				</span>
			{/if}
			<input
				type="file"
				name="avatar"
				accept="image/png,image/jpeg,image/webp,image/gif"
				bind:files={avatarFile}
				onchange={prepareAvatar}
				class="max-w-full min-w-0 flex-1 text-sm text-mut file:mr-3 file:rounded-full file:border file:border-line file:bg-transparent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink"
			/>
			<button
				disabled={!avatarFile?.length}
				class="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:opacity-90 disabled:opacity-40"
			>
				Enregistrer l'image
			</button>
			{#if data.hasAvatar}
				<button
					formaction="?/removeAvatar"
					class="rounded-full border border-line px-4 py-2 text-sm font-semibold text-mut hover:border-mut hover:text-ink"
				>
					Retirer
				</button>
			{/if}
		</form>
		<form method="POST" action="?/setPassword" use:enhance class="flex flex-wrap items-center gap-2">
			<input
				type="password"
				name="password"
				placeholder={data.hasPassword ? 'Nouveau mot de passe' : 'Mot de passe'}
				autocomplete="new-password"
				class="min-w-0 flex-1 rounded-xl border border-line bg-bg px-4 py-2 text-sm text-ink placeholder:text-mut focus:border-brand focus:outline-none"
			/>
			<button class="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:opacity-90">
				{data.hasPassword ? 'Changer' : 'Définir'}
			</button>
			{#if data.hasPassword}
				<button
					formaction="?/clearPassword"
					class="rounded-full border border-line px-4 py-2 text-sm font-semibold text-mut hover:border-mut hover:text-ink"
				>
					Retirer le mot de passe
				</button>
			{/if}
		</form>
		<p class="text-xs text-mut">
			Sans mot de passe, le profil s'ouvre d'un clic sur l'écran des profils.
		</p>
		{#if form?.profileError}
			<p class="text-sm text-red-400">{form.profileError}</p>
		{:else if form?.profileOk}
			<p class="text-sm text-ok">✓ {form.profileOk}</p>
		{/if}
	</div>
</section>

<section class="mt-6">
	<h2 class="mb-3 text-sm font-semibold tracking-wide text-mut uppercase">Données</h2>
	<div class="space-y-3 rounded-2xl bg-card p-4">
		<div class="flex flex-wrap items-center gap-2">
			<a
				href="/profil/export"
				class="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:opacity-90"
			>
				⬇ Exporter la base
			</a>
			<span class="text-xs text-mut">Télécharge un fichier .db avec tout (séries, historique, statuts).</span>
		</div>
		<form
			method="POST"
			action="?/import"
			enctype="multipart/form-data"
			use:enhance={() => {
				importing = true;
				return async ({ update }) => {
					await update();
					importing = false;
				};
			}}
			class="flex flex-wrap items-center gap-2"
		>
			<input
				type="file"
				name="db"
				accept=".db,application/vnd.sqlite3,application/x-sqlite3"
				bind:files={importFile}
				class="max-w-full text-sm text-mut file:mr-3 file:rounded-full file:border file:border-line file:bg-transparent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink"
			/>
			<button
				disabled={!importFile?.length || importing}
				class="rounded-full border border-line px-4 py-2 text-sm font-semibold text-mut hover:border-mut hover:text-ink disabled:opacity-40"
			>
				{importing ? 'Import…' : 'Importer (remplace les données actuelles)'}
			</button>
		</form>
		{#if form?.error}
			<p class="text-sm text-red-400">{form.error}</p>
		{:else if form?.imported}
			<p class="text-sm text-ok">
				✓ Import réussi : {form.imported.shows} séries, {form.imported.movies} film{form.imported.movies > 1 ? 's' : ''},
				{form.imported.watches.toLocaleString('fr-FR')} visionnages.
			</p>
		{/if}
	</div>
</section>

{#if data.watchedShows.length}
	<section class="mt-6">
		<h2 class="mb-3 text-sm font-semibold tracking-wide text-mut uppercase">
			Séries vues · {data.watchedShows.length}
		</h2>
		<ul class="space-y-1.5">
			{#each data.watchedShows as show, i (show.id)}
				<li>
					<a
						href="/series/{show.tmdbId}"
						class="flex items-center gap-3 rounded-xl bg-card p-2 pr-4 transition-colors hover:bg-card-hover"
					>
						<span class="w-6 shrink-0 text-center text-xs text-mut tabular-nums">{i + 1}</span>
						<div class="h-14 w-10 shrink-0 overflow-hidden rounded-md">
							<Poster path={show.posterPath} alt="" size="w185" />
						</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-semibold">{show.name}</p>
							<p class="text-xs text-mut">{show.watchedCount} épisodes</p>
						</div>
						<span class="shrink-0 text-sm font-medium text-mut tabular-nums">{hours(show.minutesWatched)}</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}
