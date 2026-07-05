# TV Time local

Application web auto-hébergée de suivi de séries, pensée comme un remplacement minimaliste de TV Time (fermé en juillet 2026) : épisodes à voir, calendrier des sorties, détail des saisons, recherche et statistiques — sans la partie sociale.

- **Fil** : onglet **À voir** (le prochain épisode de chaque série, à cocher) et onglet **À venir** (les prochaines diffusions, groupées par date)
- **Séries** : votre bibliothèque avec barres de progression et filtres (en cours, à jour, arrêtées, terminées, pas commencées)
- **Détail série** : saisons dépliables, épisodes cochables, « tout marquer », « vu jusqu'ici », **arrêter/reprendre** une série, favori, suppression
- **Recherche** : ajout de nouvelles séries via TMDB (métadonnées en français)
- **Profil** : temps total devant l'écran, épisodes par mois, répartition par genre, classement des séries vues

Les séries encore en production sont rafraîchies automatiquement chaque nuit (nouvelles saisons, dates de diffusion). Installable comme PWA sur mobile.

## Prérequis

1. **Une clé API TMDB** (gratuite) : créer un compte sur [themoviedb.org](https://www.themoviedb.org/signup), puis [Paramètres → API](https://www.themoviedb.org/settings/api). La clé v3 comme le jeton v4 (« Read Access Token ») fonctionnent.
2. Copier `.env.example` vers `.env` et renseigner `TMDB_API_KEY` (et `AUTH_PASSWORD` si l'app est exposée sur internet).

## Import des données TV Time (export GDPR)

Avec Node installé (une seule fois, ~2 min) :

```sh
npm install
npm run import -- "C:\chemin\vers\gdpr-data"
```

Le script importe les séries suivies (avec leur statut « arrêtée »), tout l'historique de visionnage avec les dates réelles, et les favoris. Il affiche un rapport final (séries non trouvées sur TMDB, comparaison du temps total avec la référence TV Time). Il est relançable sans doublons en cas d'interruption.

## Lancement

### En développement

```sh
npm install
npm run dev
```

### Avec Docker (recommandé pour l'auto-hébergement)

```sh
docker compose up -d --build
```

L'app écoute sur `http://localhost:3000`. La base SQLite est persistée dans `./data/`.

Pour importer l'export GDPR depuis le container : décommenter le volume `gdpr` dans `docker-compose.yml`, puis :

```sh
docker compose exec tvtime npx tsx scripts/import-tvtime.ts /gdpr
```

## Configuration (`.env`)

| Variable | Rôle |
| --- | --- |
| `TMDB_API_KEY` | Clé API TMDB (obligatoire) |
| `AUTH_PASSWORD` | Mot de passe de connexion ; vide = pas d'authentification (usage LAN) |
| `ORIGIN` | URL exacte d'accès à l'app en déploiement (ex. `http://192.168.1.10:3000`) — requis hors localhost, sinon les formulaires sont rejetés (CSRF) |
| `DATABASE_PATH` | Chemin de la base SQLite (défaut `./data/tvtime.db`) |

## Déploiement sur un serveur (CI + Portainer)

1. **Publier le dépôt sur GitHub** : la CI (`.github/workflows/docker.yml`) build l'image à chaque push sur `master`/`main` et la pousse sur `ghcr.io/<utilisateur>/tvtimelocal:latest` (aucun secret à configurer, `GITHUB_TOKEN` suffit).
2. **Portainer** : Stacks → Add stack → coller `portainer-stack.yml` (remplacer `VOTRE_UTILISATEUR`), renseigner `TMDB_API_KEY`, `AUTH_PASSWORD` et `ORIGIN` dans les variables d'environnement du stack. Si le paquet ghcr est privé, déclarer le registre dans Portainer → Registries avec un PAT GitHub (`read:packages`).
3. **Récupérer vos données** : copier votre `data/tvtime.db` local dans le volume du container, par exemple :
   ```sh
   docker cp data/tvtime.db tvtimelocal:/app/data/tvtime.db && docker restart tvtimelocal
   ```
   (ou relancer l'import GDPR depuis le container, cf. plus haut).
4. Mise à jour : re-pull l'image dans Portainer (« Recreate » avec re-pull) après chaque push.

## Commandes utiles

| Commande | Rôle |
| --- | --- |
| `npm run import -- <dossier>` | Import de l'export GDPR TV Time |
| `npm run sync` | Rafraîchir immédiatement toutes les séries en cours |
| `npm run db:generate` | Régénérer les migrations après modification du schéma |
| `npm run check` | Vérification TypeScript/Svelte |

## Stack

SvelteKit (Svelte 5) · SQLite (better-sqlite3 + Drizzle) · Tailwind CSS v4 · adapter-node · Docker

Ce produit utilise l'API TMDB sans être approuvé ni certifié par TMDB.
