<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	const initial = (name: string) => name.trim().charAt(0).toUpperCase() || '?';
	// Même couleur d'avatar que sur le sélecteur
	const HUES = [210, 340, 25, 130, 275, 55, 180];
	const hue = (id: number) => HUES[id % HUES.length];
</script>

<svelte:head>
	<title>{data.profile.name} — TV Time local</title>
</svelte:head>

<div class="flex min-h-[70vh] items-center justify-center">
	<form method="POST" use:enhance class="w-full max-w-sm rounded-2xl bg-card p-6">
		<div class="mb-5 flex flex-col items-center gap-2">
			{#if data.profile.hasAvatar}
				<img
					src="/profils/{data.profile.id}/avatar"
					alt=""
					class="h-20 w-20 rounded-full object-cover"
				/>
			{:else}
				<span
					class="flex h-20 w-20 items-center justify-center rounded-full text-3xl font-bold text-white"
					style="background: hsl({hue(data.profile.id)} 60% 45%)"
				>
					{initial(data.profile.name)}
				</span>
			{/if}
			<h1 class="text-xl font-bold">{data.profile.name}</h1>
			<p class="text-xs text-mut">🔒 Profil protégé</p>
		</div>
		<!-- svelte-ignore a11y_autofocus -->
		<input
			type="password"
			name="password"
			placeholder="Mot de passe"
			autocomplete="current-password"
			autofocus
			class="mb-3 w-full rounded-xl border border-line bg-bg px-4 py-3 text-ink placeholder:text-mut focus:border-brand focus:outline-none"
		/>
		{#if form?.error}
			<p class="mb-3 text-sm text-red-400">{form.error}</p>
		{/if}
		<button class="w-full rounded-xl bg-brand py-3 font-semibold text-brand-ink hover:opacity-90">
			Entrer
		</button>
		<a href="/profils" class="mt-4 block text-center text-sm text-mut hover:text-ink">
			← Choisir un autre profil
		</a>
	</form>
</div>
