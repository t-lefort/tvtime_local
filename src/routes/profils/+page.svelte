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
</script>

<svelte:head>
	<title>Profils — TV Time local</title>
</svelte:head>

<div class="flex min-h-[70vh] flex-col items-center justify-center py-8">
	<p class="mb-1 text-center text-3xl">📺</p>
	<h1 class="mb-8 text-center text-2xl font-bold">Qui regarde ?</h1>

	{#if data.users.length}
		<ul class="mb-8 flex max-w-lg flex-wrap justify-center gap-4">
			{#each data.users as user (user.id)}
				<li class="relative">
					<form method="POST" action="?/select" use:enhance>
						<input type="hidden" name="userId" value={user.id} />
						<button
							class="group flex w-28 flex-col items-center gap-2 rounded-2xl p-3 transition-colors hover:bg-card
								{user.id === data.currentUserId ? 'bg-card' : ''}"
						>
							<span
								class="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white"
								style="background: hsl({hue(user.id)} 60% 45%)"
							>
								{initial(user.name)}
							</span>
							<span class="max-w-full truncate text-sm font-semibold">{user.name}</span>
							<span class="text-[11px] text-mut">{user.shows} séries · {user.movies} films</span>
						</button>
					</form>
					{#if managing}
						<form method="POST" action="?/delete" use:enhance={() => {
							armedId = null;
							return async ({ update }) => update();
						}}>
							<input type="hidden" name="userId" value={user.id} />
							{#if armedId === user.id}
								<button
									class="absolute -top-1 -right-1 rounded-full bg-red-500 px-2 py-1 text-[11px] font-semibold text-white"
								>
									Supprimer ?
								</button>
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
		</ul>
	{:else}
		<p class="mb-6 text-sm text-mut">Créez un premier profil pour commencer.</p>
	{/if}

	<form method="POST" action="?/create" use:enhance class="flex w-full max-w-sm gap-2">
		<input
			type="text"
			name="name"
			placeholder="Nouveau profil"
			maxlength="30"
			autocomplete="off"
			class="min-w-0 flex-1 rounded-xl border border-line bg-bg px-4 py-3 text-ink placeholder:text-mut focus:border-brand focus:outline-none"
		/>
		<button class="shrink-0 rounded-xl bg-brand px-4 py-3 font-semibold text-brand-ink hover:opacity-90">
			Créer
		</button>
	</form>

	{#if form?.error}
		<p class="mt-3 text-sm text-red-400">{form.error}</p>
	{/if}

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
