# TV Time local

Self-hosted web app for tracking TV shows **and movies**, designed as a minimalist replacement for TV Time (shut down in July 2026): episodes to watch, release calendar, season details, search, statistics and streaming platforms — without the social features.

- **Feed**: **To watch** tab (the next episode of each show, ready to check off) and **Upcoming** tab (upcoming air dates, grouped by date)
- **Shows**: your library with progress bars and filters (watching, up to date, stopped, finished, not started)
- **Show detail**: expandable seasons, checkable episodes, "mark all", "watched up to here", **stop/resume** a show, favorite, deletion
- **Movies**: collection with filters (to watch, watched, favorites), mark watched/unwatched, rewatches, favorite
- **Where to watch**: on every show and movie, the streaming platforms where the title is available (subscription, free, rent/buy — JustWatch data via TMDB, region configurable with `WATCH_REGION`, `FR` by default)
- **Search**: add shows and movies via TMDB (French metadata)
- **Profile**: total screen time (shows + movies), watch counts per month, genre breakdown, ranking of watched shows

Shows still in production are refreshed automatically every night (new seasons, air dates), along with the streaming platforms of the whole library. Installable as a PWA on mobile.

## Prerequisites

1. **A TMDB API key** (free): create an account on [themoviedb.org](https://www.themoviedb.org/signup), then go to [Settings → API](https://www.themoviedb.org/settings/api). Both the v3 key and the v4 token ("Read Access Token") work.
2. Copy `.env.example` to `.env` and set `TMDB_API_KEY` (and `AUTH_PASSWORD` if the app is exposed to the internet).

## Importing TV Time data (GDPR export)

With Node installed (one-time, ~2 min):

```sh
npm install
npm run import -- "C:\path\to\gdpr-data"
```

The script imports followed shows (including their "stopped" status), movies to watch, the full watch history for shows + movies with actual dates, and show favorites. It prints a final report (shows/movies not found on TMDB, total time compared against the TV Time reference). It can be re-run without creating duplicates if interrupted.

## Running

### In development

```sh
npm install
npm run dev
```

### With Docker (recommended for self-hosting)

```sh
docker compose up -d --build
```

The app listens on `http://localhost:3000`. The SQLite database is persisted in `./data/`.

To import the GDPR export from inside the container: uncomment the `gdpr` volume in `docker-compose.yml`, then:

```sh
docker compose exec tvtime npx tsx scripts/import-tvtime.ts /gdpr
```

## Configuration (`.env`)

| Variable | Purpose |
| --- | --- |
| `TMDB_API_KEY` | TMDB API key (required) |
| `AUTH_PASSWORD` | Login password; empty = no authentication (LAN use) |
| `ORIGIN` | Exact URL used to access the app when deployed (e.g. `http://192.168.1.10:3000`) — required outside localhost, otherwise form submissions are rejected (CSRF) |
| `DATABASE_PATH` | SQLite database path (default `./data/tvtime.db`) |

## Deploying to a server (CI + Portainer)

1. **Publish the repository on GitHub**: the CI (`.github/workflows/docker.yml`) builds the image on every push to `master`/`main` and pushes it to `ghcr.io/<user>/tvtimelocal:latest` (no secrets to configure, `GITHUB_TOKEN` is enough).
2. **Portainer**: Stacks → Add stack → paste `portainer-stack.yml` (replace `YOUR_USERNAME`), set `TMDB_API_KEY`, `AUTH_PASSWORD` and `ORIGIN` in the stack's environment variables. If the ghcr package is private, declare the registry in Portainer → Registries with a GitHub PAT (`read:packages`).
3. **Transfer your data**: on the local instance, Profile → **Export database** (downloads a `.db` file), then on the server instance, Profile → **Import**. That's it.
4. Updating: re-pull the image in Portainer ("Recreate" with re-pull) after each push.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run import -- <folder>` | Import the TV Time GDPR export |
| `npm run sync` | Refresh all in-production shows immediately |
| `npm run db:generate` | Regenerate migrations after a schema change |
| `npm run check` | TypeScript/Svelte check |

## Stack

SvelteKit (Svelte 5) · SQLite (better-sqlite3 + Drizzle) · Tailwind CSS v4 · adapter-node · Docker

This product uses the TMDB API but is not endorsed or certified by TMDB.
