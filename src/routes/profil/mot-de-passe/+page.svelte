<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Mot de passe — TV Time local</title>
</svelte:head>

<div class="mb-4 flex items-center gap-3">
	<a
		href="/profil"
		class="flex h-9 w-9 items-center justify-center rounded-full bg-card text-lg hover:bg-card-hover"
		aria-label="Retour au profil"
	>
		←
	</a>
	<h1 class="text-2xl font-bold">Mot de passe</h1>
</div>

<section class="rounded-2xl bg-card p-5">
	<p class="mb-4 text-sm text-mut">
		{#if data.hasPassword}
			Le profil <strong class="text-ink">{data.profileName}</strong> est protégé : son mot de passe
			est demandé sur l'écran des profils.
		{:else}
			Le profil <strong class="text-ink">{data.profileName}</strong> n'a pas de mot de passe :
			il s'ouvre d'un clic sur l'écran des profils.
		{/if}
	</p>

	<form method="POST" action="?/set" use:enhance class="flex flex-wrap items-center gap-2">
		<input
			type="password"
			name="password"
			placeholder={data.hasPassword ? 'Nouveau mot de passe' : 'Mot de passe'}
			autocomplete="new-password"
			class="min-w-0 flex-1 rounded-xl border border-line bg-bg px-4 py-2.5 text-sm text-ink placeholder:text-mut focus:border-brand focus:outline-none"
		/>
		<button class="rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink hover:opacity-90">
			{data.hasPassword ? 'Changer' : 'Définir'}
		</button>
	</form>

	{#if data.hasPassword}
		<form method="POST" action="?/clear" use:enhance class="mt-3">
			<button class="rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-mut hover:border-mut hover:text-ink">
				Retirer le mot de passe
			</button>
		</form>
	{/if}

	{#if form?.error}
		<p class="mt-3 text-sm text-red-400">{form.error}</p>
	{:else if form?.ok}
		<p class="mt-3 text-sm text-ok">✓ {form.ok}</p>
	{/if}
</section>
