<script lang="ts">
	import { tmdbImg } from '$lib/format';
	import type { StoredCastMember } from '$lib/server/tmdb';

	type ProfiledPerson = Pick<StoredCastMember, 'id' | 'name' | 'profilePath'> & {
		character?: string | null;
	};

	/** `fullHref` pointe vers /casting/... : sans lui, aucun bouton « casting complet ». */
	let {
		cast,
		title = 'Distribution',
		fullHref = null
	}: { cast: ProfiledPerson[]; title?: string; fullHref?: string | null } = $props();

	let fullCast = $state<ProfiledPerson[] | null>(null);
	let expanded = $state(false);
	let loading = $state(false);
	let failed = $state(false);

	// Changer de fiche réutilise le composant : on repart de la distribution principale.
	$effect(() => {
		void fullHref;
		fullCast = null;
		expanded = false;
		loading = false;
		failed = false;
	});

	const shown = $derived(expanded && fullCast ? fullCast : cast);
	const extraCount = $derived(fullCast ? fullCast.length - cast.length : 0);
	// Vue dépliée : les personnes sans photo passent à la fin, en simple liste de noms.
	const shownWithPhoto = $derived(shown.filter((member) => member.profilePath));
	const shownWithoutPhoto = $derived(shown.filter((member) => !member.profilePath));

	async function toggle() {
		if (expanded) {
			expanded = false;
			return;
		}
		if (fullCast) {
			expanded = true;
			return;
		}
		if (!fullHref) return;
		loading = true;
		failed = false;
		try {
			const res = await fetch(fullHref);
			if (!res.ok) throw new Error(String(res.status));
			fullCast = ((await res.json()) as { cast: ProfiledPerson[] }).cast;
			expanded = true;
		} catch {
			failed = true;
		} finally {
			loading = false;
		}
	}
</script>

{#snippet person(member: ProfiledPerson)}
	<a href="/personnes/{member.id}" class="group block" title="Voir la filmographie de {member.name}">
		<div class="aspect-[2/3] overflow-hidden rounded-lg bg-card ring-1 ring-line group-hover:ring-brand">
			{#if member.profilePath}
				<img
					src={tmdbImg(member.profilePath, 'w185')}
					alt={member.name}
					loading="lazy"
					class="h-full w-full object-cover"
				/>
			{:else}
				<div class="flex h-full w-full items-center justify-center text-2xl text-mut">🎭</div>
			{/if}
		</div>
		<p class="mt-1 line-clamp-2 text-xs font-medium leading-tight group-hover:text-brand">
			{member.name}
		</p>
		{#if member.character}
			<p class="line-clamp-2 text-[11px] leading-tight text-mut">{member.character}</p>
		{/if}
	</a>
{/snippet}

{#if cast.length}
	<section class="mt-6">
		<div class="mb-2 flex items-baseline justify-between gap-3">
			<h2 class="text-sm font-semibold tracking-wide text-mut uppercase">{title}</h2>
			{#if fullHref}
				<button
					type="button"
					onclick={toggle}
					disabled={loading}
					class="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-medium text-mut transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
				>
					{#if loading}
						Chargement…
					{:else if expanded}
						Réduire
					{:else if fullCast}
						Tout le casting{extraCount > 0 ? ` (${fullCast.length})` : ''}
					{:else}
						Tout le casting
					{/if}
				</button>
			{/if}
		</div>

		{#if failed}
			<p class="mb-2 text-xs text-mut">Casting complet indisponible pour l'instant.</p>
		{/if}

		{#if expanded}
			<ul class="flex flex-wrap gap-x-3 gap-y-4 py-2">
				{#each shownWithPhoto as member (member.id)}
					<li class="w-20 shrink-0">{@render person(member)}</li>
				{/each}
			</ul>

			{#if shownWithoutPhoto.length}
				<section class="mt-4 border-t border-line/70 pt-4">
					<h3 class="text-xs font-semibold tracking-wide text-mut uppercase">
						Sans photo <span class="font-normal">({shownWithoutPhoto.length})</span>
					</h3>
					<div class="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{#each shownWithoutPhoto as member (member.id)}
							<a
								href="/personnes/{member.id}"
								class="block min-w-0 rounded-lg bg-card px-3 py-2.5 ring-1 ring-line transition-colors hover:ring-brand"
								title="Voir la filmographie de {member.name}"
							>
								<p class="text-sm leading-snug font-medium">{member.name}</p>
								{#if member.character}
									<p class="mt-0.5 text-xs leading-snug text-mut">{member.character}</p>
								{/if}
							</a>
						{/each}
					</div>
				</section>
			{/if}
		{:else}
			<ul class="-mx-4 flex gap-3 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
				{#each shown as member (member.id)}
					<li class="w-20 shrink-0">{@render person(member)}</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}
