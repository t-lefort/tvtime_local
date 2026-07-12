<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
</script>

<svelte:head>
	<title>Nouveau profil — TV Time local</title>
</svelte:head>

<div class="flex min-h-[70vh] items-center justify-center">
	<form method="POST" use:enhance class="w-full max-w-sm rounded-2xl bg-card p-6">
		<p class="mb-1 text-center text-3xl">📺</p>
		<h1 class="mb-5 text-center text-xl font-bold">Nouveau profil</h1>
		<!-- svelte-ignore a11y_autofocus -->
		<input
			type="text"
			name="name"
			placeholder="Nom du profil"
			maxlength="30"
			autocomplete="off"
			autofocus
			class="mb-3 w-full rounded-xl border border-line bg-bg px-4 py-3 text-ink placeholder:text-mut focus:border-brand focus:outline-none"
		/>
		<input
			type="password"
			name="password"
			placeholder="Mot de passe (optionnel)"
			autocomplete="new-password"
			class="mb-1 w-full rounded-xl border border-line bg-bg px-4 py-3 text-ink placeholder:text-mut focus:border-brand focus:outline-none"
		/>
		<p class="mb-3 text-xs text-mut">Sans mot de passe, le profil s'ouvre d'un clic.</p>
		{#if form?.error}
			<p class="mb-3 text-sm text-red-400">{form.error}</p>
		{/if}
		<button class="w-full rounded-xl bg-brand py-3 font-semibold text-brand-ink hover:opacity-90">
			Créer le profil
		</button>
		<a href="/profils" class="mt-4 block text-center text-sm text-mut hover:text-ink">
			← Retour aux profils
		</a>
	</form>
</div>
