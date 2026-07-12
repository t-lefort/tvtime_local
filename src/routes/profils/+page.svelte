<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	let managing = $state(false);
	// Suppression en deux temps (pas de dialogue navigateur) : premier clic arme, second confirme
	let armedId = $state<number | null>(null);

	const initial = (name: string) => name.trim().charAt(0).toUpperCase() || '?';
	// Couleur d'avatar stable par profil
	const HUES = [210, 340, 25, 130, 275, 55, 180];
	const hue = (id: number) => HUES[id % HUES.length];

	const errorFor = (userId: number) =>
		form && 'userId' in form && form.userId === userId ? form.error : null;

	const cardClass =
		'group flex w-full flex-col items-center gap-2 rounded-2xl p-3 transition-colors hover:bg-card';
</script>

{#snippet card(user: (typeof data.users)[number])}
	{#if user.hasAvatar}
		<img src="/profils/{user.id}/avatar" alt="" class="h-16 w-16 rounded-full object-cover" />
	{:else}
		<span
			class="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white"
			style="background: hsl({hue(user.id)} 60% 45%)"
		>
			{initial(user.name)}
		</span>
	{/if}
	<span class="flex max-w-full items-center gap-1 text-sm font-semibold">
		<span class="truncate">{user.name}</span>
		{#if user.hasPassword}<span class="shrink-0 text-xs" title="Profil protégé">🔒</span>{/if}
	</span>
	<span class="text-[11px] whitespace-nowrap text-mut">{user.shows} séries · {user.movies} films</span>
{/snippet}

<svelte:head>
	<title>Profils — TV Time local</title>
</svelte:head>

<div class="flex min-h-[70vh] flex-col items-center justify-center py-8">
	<p class="mb-1 text-center text-3xl">📺</p>
	<h1 class="mb-8 text-center text-2xl font-bold">Qui regarde ?</h1>

	{#if !data.users.length}
		<p class="mb-6 text-sm text-mut">Créez un premier profil pour commencer.</p>
	{/if}

	<ul class="flex max-w-lg flex-wrap justify-center gap-4">
		{#each data.users as user (user.id)}
				<li class="relative flex w-32 flex-col items-center">
					{#if user.hasPassword}
						<!-- Profil protégé : page de connexion dédiée -->
						<a
							href="/profils/{user.id}/connexion"
							class="{cardClass} {user.id === data.currentUserId ? 'bg-card' : ''}"
						>
							{@render card(user)}
						</a>
					{:else}
						<form method="POST" action="?/select" use:enhance class="w-full">
							<input type="hidden" name="userId" value={user.id} />
							<button class="{cardClass} {user.id === data.currentUserId ? 'bg-card' : ''}">
								{@render card(user)}
							</button>
						</form>
					{/if}
					{#if managing}
						<form method="POST" action="?/delete" use:enhance={() => {
							return async ({ update }) => {
								armedId = null;
								await update();
							};
						}} class="contents">
							<input type="hidden" name="userId" value={user.id} />
							{#if armedId === user.id}
								{#if user.hasPassword}
									<div class="mt-1 flex w-full flex-col gap-1">
										<!-- svelte-ignore a11y_autofocus -->
										<input
											type="password"
											name="password"
											placeholder="Mot de passe"
											autofocus
											class="w-full rounded-lg border border-line bg-bg px-2 py-1.5 text-sm text-ink placeholder:text-mut focus:border-brand focus:outline-none"
										/>
										<button class="w-full rounded-lg bg-red-500 py-1.5 text-sm font-semibold text-white hover:opacity-90">
											Supprimer
										</button>
										{#if errorFor(user.id)}
											<p class="text-center text-xs text-red-400">{errorFor(user.id)}</p>
										{/if}
									</div>
								{:else}
									<button
										class="absolute -top-1 -right-1 rounded-full bg-red-500 px-2 py-1 text-[11px] font-semibold text-white"
									>
										Supprimer ?
									</button>
								{/if}
							{:else}
								<button
									type="button"
									onclick={() => (armedId = user.id)}
									aria-label="Supprimer {user.name}"
									class="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-card text-mut ring-1 ring-line hover:text-red-400"
								>
									✕
								</button>
							{/if}
						</form>
					{/if}
				</li>
			{/each}
			<li class="flex w-32 flex-col items-center">
				<a href="/profils/nouveau" class={cardClass}>
					<span
						class="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-line text-3xl text-mut transition-colors group-hover:border-mut group-hover:text-ink"
					>
						+
					</span>
					<span class="text-sm font-semibold">Nouveau profil</span>
					<span class="text-[11px] text-mut">&nbsp;</span>
				</a>
			</li>
	</ul>

	{#if data.users.length}
		<button
			type="button"
			onclick={() => {
				managing = !managing;
				armedId = null;
			}}
			class="mt-6 text-sm text-mut hover:text-ink"
		>
			{managing ? 'Terminé' : 'Gérer les profils'}
		</button>
	{/if}
</div>
