<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Poster from '$lib/components/Poster.svelte';
	import { formatDuration, formatMonth } from '$lib/format';

	let { data, form } = $props();
	let importFile = $state<FileList | null>(null);
	let importing = $state(false);

	// ---- Import de l'export GDPR TV Time (job serveur suivi par sondage) ----
	let tvtimeFiles = $state<FileList | null>(null);
	let tvtimeStarting = $state(false);
	// svelte-ignore state_referenced_locally -- valeur initiale seulement, mise à jour ensuite par le sondage
	let tvtimeJob = $state(data.tvtimeJob);

	const TVTIME_PHASES: Record<string, string> = {
		préparation: 'Lecture des fichiers',
		séries: 'Import des séries',
		films: 'Import des films',
		visionnages: 'Historique des visionnages',
		terminé: 'Terminé'
	};

	async function refreshTvTimeJob() {
		try {
			const res = await fetch('/profil/import-tvtime');
			if (res.ok) tvtimeJob = await res.json();
		} catch {
			// erreur réseau passagère : le prochain tick réessaiera
		}
	}

	// Suit la progression tant qu'un import tourne, puis recharge les stats de la page
	$effect(() => {
		if (!tvtimeJob?.running) return;
		const timer = setInterval(async () => {
			await refreshTvTimeJob();
			if (!tvtimeJob?.running) await invalidateAll();
		}, 2000);
		return () => clearInterval(timer);
	});

	const tvtimeReport = $derived(tvtimeJob && !tvtimeJob.running ? tvtimeJob.report : undefined);
	const tvtimeIssues = $derived(
		tvtimeReport
			? tvtimeReport.unmappedShows.length +
					tvtimeReport.unmappedMovies.length +
					tvtimeReport.failedShows.length +
					tvtimeReport.failedMovies.length +
					tvtimeReport.matchedByName.length +
					tvtimeReport.matchedMoviesByName.length +
					tvtimeReport.unmatchedEpisodes.length +
					tvtimeReport.unmatchedMovieWatches.length
			: 0
	);
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
	<a href="/profils" class="text-sm text-mut hover:text-ink">Changer de profil</a>
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
					<a
						href="/genres/{encodeURIComponent(g.genre)}"
						class="w-32 shrink-0 truncate text-sm hover:text-brand hover:underline"
						title="Explorer le genre {g.genre}">{g.genre}</a
					>
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
	<div class="divide-y divide-line rounded-2xl bg-card">
		<form method="POST" action="?/rename" use:enhance class="space-y-2 p-4">
			<label for="profil-nom" class="block text-sm font-semibold">Nom du profil</label>
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
				<input
					id="profil-nom"
					type="text"
					name="name"
					value={data.profileName}
					maxlength="30"
					autocomplete="off"
					class="w-full min-w-0 rounded-xl border border-line bg-bg px-4 py-2 text-sm text-ink placeholder:text-mut focus:border-brand focus:outline-none sm:flex-1"
				/>
				<button
					class="w-full shrink-0 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:opacity-90 sm:w-auto"
				>
					Renommer
				</button>
			</div>
		</form>
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
			class="space-y-2 p-4"
		>
			<label for="profil-image" class="block text-sm font-semibold">Image du profil</label>
			<div class="flex items-center gap-3">
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
					id="profil-image"
					type="file"
					name="avatar"
					accept="image/png,image/jpeg,image/webp,image/gif"
					bind:files={avatarFile}
					onchange={prepareAvatar}
					class="min-w-0 flex-1 text-sm text-mut file:mr-3 file:rounded-full file:border file:border-line file:bg-transparent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink"
				/>
			</div>
			<div class="flex flex-col gap-2 sm:flex-row">
				<button
					disabled={!avatarFile?.length}
					class="w-full rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:opacity-90 disabled:opacity-40 sm:w-auto"
				>
					Enregistrer l'image
				</button>
				{#if data.hasAvatar}
					<button
						formaction="?/removeAvatar"
						class="w-full rounded-full border border-line px-4 py-2 text-sm font-semibold text-mut hover:border-mut hover:text-ink sm:w-auto"
					>
						Retirer l'image
					</button>
				{/if}
			</div>
		</form>
		<form method="POST" action="?/toggleOverviews" use:enhance class="flex items-center justify-between gap-4 p-4">
			<div class="min-w-0">
				<p class="text-sm font-semibold">Masquer les descriptions d'épisodes</p>
				<p class="mt-0.5 text-xs text-mut">
					Anti-spoiler : le résumé des épisodes est masqué dans le fil et sur la fiche épisode.
				</p>
			</div>
			<input type="hidden" name="hide" value={data.hideEpisodeOverviews ? '' : '1'} />
			<button
				role="switch"
				aria-checked={data.hideEpisodeOverviews}
				aria-label="Masquer les descriptions d'épisodes"
				class="relative h-7 w-12 shrink-0 rounded-full transition-colors
					{data.hideEpisodeOverviews ? 'bg-brand' : 'bg-line'}"
			>
				<span
					class="absolute top-1 left-1 h-5 w-5 rounded-full bg-bg transition-transform
						{data.hideEpisodeOverviews ? 'translate-x-5' : ''}"
				></span>
			</button>
		</form>
		<form method="POST" action="?/setPassword" use:enhance class="space-y-2 p-4">
			<label for="profil-mdp" class="block text-sm font-semibold">
				{data.hasPassword ? 'Nouveau mot de passe' : 'Mot de passe'}
			</label>
			<p class="text-xs text-mut">
				Sans mot de passe, le profil s'ouvre d'un clic sur l'écran des profils.
			</p>
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
				<input
					id="profil-mdp"
					type="password"
					name="password"
					placeholder={data.hasPassword ? 'Nouveau mot de passe' : 'Mot de passe'}
					autocomplete="new-password"
					class="w-full min-w-0 rounded-xl border border-line bg-bg px-4 py-2 text-sm text-ink placeholder:text-mut focus:border-brand focus:outline-none sm:flex-1"
				/>
				<button
					class="w-full shrink-0 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:opacity-90 sm:w-auto"
				>
					{data.hasPassword ? 'Changer' : 'Définir'}
				</button>
				{#if data.hasPassword}
					<button
						formaction="?/clearPassword"
						class="w-full shrink-0 rounded-full border border-line px-4 py-2 text-sm font-semibold text-mut hover:border-mut hover:text-ink sm:w-auto"
					>
						Retirer le mot de passe
					</button>
				{/if}
			</div>
		</form>
		{#if form?.profileError}
			<p class="p-4 text-sm text-red-400">{form.profileError}</p>
		{:else if form?.profileOk}
			<p class="p-4 text-sm text-ok">✓ {form.profileOk}</p>
		{/if}
	</div>
</section>

<section class="mt-6">
	<h2 class="mb-3 text-sm font-semibold tracking-wide text-mut uppercase">Données</h2>
	<div class="space-y-3 rounded-2xl bg-card p-4">
		<div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
			<a
				href="/profil/export"
				class="w-full shrink-0 rounded-full bg-brand px-4 py-2 text-center text-sm font-semibold text-brand-ink hover:opacity-90 sm:w-auto"
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
			class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
		>
			<input
				type="file"
				name="db"
				accept=".db,application/vnd.sqlite3,application/x-sqlite3"
				bind:files={importFile}
				class="min-w-0 max-w-full text-sm text-mut file:mr-3 file:rounded-full file:border file:border-line file:bg-transparent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink"
			/>
			<button
				disabled={!importFile?.length || importing}
				class="w-full shrink-0 rounded-full border border-line px-4 py-2 text-sm font-semibold text-mut hover:border-mut hover:text-ink disabled:opacity-40 sm:w-auto"
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

<section class="mt-6">
	<h2 class="mb-3 text-sm font-semibold tracking-wide text-mut uppercase">Import TV Time</h2>
	<div class="space-y-3 rounded-2xl bg-card p-4">
		<p class="text-xs text-mut">
			Déposez le zip de l'export GDPR reçu de TV Time (ou ses fichiers CSV) : séries suivies, films
			et historique complet sont ajoutés au profil « {data.profileName} », sans toucher aux autres
			profils. Relançable sans créer de doublons.
		</p>
		<form
			method="POST"
			action="?/importTvTime"
			enctype="multipart/form-data"
			use:enhance={() => {
				tvtimeStarting = true;
				return async ({ update }) => {
					await update();
					tvtimeStarting = false;
					await refreshTvTimeJob();
				};
			}}
			class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
		>
			<input
				type="file"
				name="gdpr"
				accept=".zip,.csv"
				multiple
				bind:files={tvtimeFiles}
				class="min-w-0 max-w-full text-sm text-mut file:mr-3 file:rounded-full file:border file:border-line file:bg-transparent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink"
			/>
			<button
				disabled={!tvtimeFiles?.length || tvtimeStarting || tvtimeJob?.running}
				class="w-full shrink-0 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:opacity-90 disabled:opacity-40 sm:w-auto"
			>
				{tvtimeJob?.running ? 'Import en cours…' : 'Importer'}
			</button>
		</form>
		{#if form?.tvtimeError}
			<p class="text-sm text-red-400">{form.tvtimeError}</p>
		{/if}
		{#if tvtimeJob?.running}
			<div class="space-y-1.5">
				<div class="flex items-center justify-between gap-3 text-xs text-mut">
					<span class="truncate">
						{TVTIME_PHASES[tvtimeJob.progress.phase] ?? tvtimeJob.progress.phase}{tvtimeJob.progress.label
							? ` · ${tvtimeJob.progress.label}`
							: ''}
					</span>
					{#if tvtimeJob.progress.total > 0}
						<span class="shrink-0 tabular-nums">{tvtimeJob.progress.current}/{tvtimeJob.progress.total}</span>
					{/if}
				</div>
				<div class="h-2 overflow-hidden rounded-full bg-line/60">
					<div
						class="h-full rounded-full bg-brand transition-all"
						style="width: {tvtimeJob.progress.total > 0
							? (tvtimeJob.progress.current / tvtimeJob.progress.total) * 100
							: 0}%"
					></div>
				</div>
				{#if tvtimeJob.userId !== data.profileId}
					<p class="text-xs text-mut">Import lancé pour le profil « {tvtimeJob.userName} ».</p>
				{/if}
			</div>
		{:else if tvtimeJob?.error}
			<p class="text-sm text-red-400">✗ Import échoué : {tvtimeJob.error}</p>
		{:else if tvtimeReport}
			<p class="text-sm text-ok">
				✓ Import terminé{tvtimeJob && tvtimeJob.userId !== data.profileId
					? ` (profil « ${tvtimeJob.userName} »)`
					: ''} :
				{tvtimeReport.showsImported + tvtimeReport.showsSkipped} séries,
				{tvtimeReport.moviesImported + tvtimeReport.moviesSkipped} films,
				{(tvtimeReport.watchesInserted + tvtimeReport.movieWatchesInserted).toLocaleString('fr-FR')}
				visionnages ajoutés ({formatDuration(tvtimeReport.totalMinutes)} au total).
			</p>
			{#if tvtimeIssues > 0}
				<details class="text-xs text-mut">
					<summary class="cursor-pointer select-none">⚠ Éléments à vérifier</summary>
					<div class="mt-2 space-y-2">
						{#if tvtimeReport.unmappedShows.length}
							<p>
								<strong>{tvtimeReport.unmappedShows.length} séries introuvables sur TMDB</strong>
								(à ajouter via la recherche) :
								{tvtimeReport.unmappedShows.map((s) => s.name).join(', ')}
							</p>
						{/if}
						{#if tvtimeReport.unmappedMovies.length}
							<p>
								<strong>{tvtimeReport.unmappedMovies.length} films introuvables sur TMDB</strong>
								(à ajouter via la recherche) :
								{tvtimeReport.unmappedMovies
									.map((m) => `${m.name}${m.releaseYear ? ` (${m.releaseYear})` : ''}`)
									.join(', ')}
							</p>
						{/if}
						{#if tvtimeReport.failedShows.length}
							<p>
								<strong>{tvtimeReport.failedShows.length} séries en échec</strong>
								(relancez l'import) : {tvtimeReport.failedShows.map((f) => f.name).join(', ')}
							</p>
						{/if}
						{#if tvtimeReport.failedMovies.length}
							<p>
								<strong>{tvtimeReport.failedMovies.length} films en échec</strong>
								(relancez l'import) : {tvtimeReport.failedMovies.map((f) => f.name).join(', ')}
							</p>
						{/if}
						{#if tvtimeReport.matchedByName.length}
							<p>
								<strong>{tvtimeReport.matchedByName.length} séries mappées par nom</strong>
								(id TVDB inconnu de TMDB, à vérifier) :
								{tvtimeReport.matchedByName.map((s) => `« ${s.name} » → « ${s.tmdbName} »`).join(', ')}
							</p>
						{/if}
						{#if tvtimeReport.matchedMoviesByName.length}
							<p>
								<strong>{tvtimeReport.matchedMoviesByName.length} films mappés par nom</strong>
								(à vérifier) :
								{tvtimeReport.matchedMoviesByName
									.map((m) => `« ${m.name} » → « ${m.tmdbTitle} »`)
									.join(', ')}
							</p>
						{/if}
						{#if tvtimeReport.unmatchedEpisodes.length}
							<p>
								<strong>Visionnages sans épisode correspondant :</strong>
								{tvtimeReport.unmatchedEpisodes.map((s) => `${s.name} (${s.count})`).join(', ')}
							</p>
						{/if}
						{#if tvtimeReport.unmatchedMovieWatches.length}
							<p>
								<strong>Visionnages sans film correspondant :</strong>
								{tvtimeReport.unmatchedMovieWatches.map((m) => `${m.name} (${m.count})`).join(', ')}
							</p>
						{/if}
					</div>
				</details>
			{/if}
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
