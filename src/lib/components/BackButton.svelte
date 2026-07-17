<script lang="ts">
	import { afterNavigate } from '$app/navigation';

	let { fallback, class: klass = '' }: { fallback: string; class?: string } = $props();

	// Vrai dès qu'on est arrivé ici par une navigation interne : on peut alors
	// revenir en arrière via l'historique, ce qui restitue le filtre *et* la
	// position de défilement de la page précédente. Sinon (ouverture directe,
	// rechargement), on retombe sur le lien de repli.
	let canGoBack = $state(false);
	afterNavigate((nav) => {
		if (nav.from) canGoBack = true;
	});

	function goBack(event: MouseEvent) {
		if (canGoBack) {
			event.preventDefault();
			history.back();
		}
	}
</script>

<a href={fallback} onclick={goBack} class={klass} aria-label="Retour">←</a>
