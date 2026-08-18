# TV Time local

Self-hosted web app for tracking TV shows, movies **and books**. It combines a minimalist TV Time replacement with a personal library that can import a Bubble collection.

- **Feed**: **To watch** tab (the next episode of each show, ready to check off) and **Upcoming** tab (upcoming air dates, grouped by date)
- **Library**: one page shared by the three catalogues (shows, movies, books), with a tab bar to switch between them. It opens on the largest catalogue. Each list has the same text filter, filter chips and sort order (most recent activity or alphabetical) — all applied straight in the page, so the list follows every keystroke without a round trip
- **Shows**: your library with progress bars, filters (watching, up to date, stopped, finished, not started)
- **Show detail**: expandable seasons, checkable episodes, "mark all", "watched up to here", **stop/resume** a show, favorite, deletion. The cast shows the main billing, with a **full cast** button that loads every credited actor from TMDB (also on movies)
- **Movies**: collection with filters (to watch, watched, favorites), mark watched/unwatched, rewatches, favorite
- **Books**: personal library with owned/wishlist/reading-status filters, the same 1–10 star rating as shows and movies, a review and edition details. Add from the general search, by ISBN, manual entry or EAN-13 camera scan; Bubble CSV exports can be imported from the profile page
- **Book series**: volumes of the same series share a single library tile and a **series page** that lists every volume in order, like the episodes of a season — what you own, what you have read, and a one-click add for what is missing. Covers are downloaded once and served from `./data/covers/`, so a shelf of a hundred books does not depend on the catalogues answering a hundred times
- **Where to watch**: on every show and movie, the streaming platforms where the title is available (subscription, free, rent/buy — JustWatch data via TMDB, region configurable with `WATCH_REGION`, `FR` by default)
- **For you**: personalized suggestions of shows and movies, based on your ratings, favorites and watch history — filterable by **streaming platform** (the platforms available in your region, grouped: no "with Ads" or reseller variants). Can be hidden from the profile settings
- **Search**: add shows and movies via TMDB (French metadata) and books via Inventaire, the BnF, Open Library and Google Books. A book series comes back as a single result instead of a handful of its volumes. The default **All** tab searches the three catalogues at once; the **Shows**, **Movies** and **Books** tabs narrow it down
- **Profiles**: several people can use the same instance at the same time — each profile has its own library, watch history, favorites and stats (Netflix-style picker). A profile can optionally have a **password** (otherwise one click opens it) and a **picture** (set from the profile page)
- **Profile**: total screen time (shows + movies), watch counts per month, genre breakdown, ranking of watched shows

Shows still in production are refreshed automatically every night (new seasons, air dates), along with the streaming platforms of the whole library. Installable as a PWA on mobile.

## Prerequisites

1. **A TMDB API key** (free): create an account on [themoviedb.org](https://www.themoviedb.org/signup), then go to [Settings → API](https://www.themoviedb.org/settings/api). Both the v3 key and the v4 token ("Read Access Token") work.
2. Copy `.env.example` to `.env` and set `TMDB_API_KEY`.

## Importing TV Time data (GDPR export)

**From the app** (easiest): Profile → **Import TV Time** → drop the GDPR zip received from TV Time (or its CSV files). The import runs in the background with a progress bar and ends with a report; the data is added to the active profile without touching the other profiles.

**From the command line**, with Node installed:

```sh
npm install
npm run import -- "C:\path\to\gdpr-data" "Profile name"
```

The data is attached to the given profile (created if needed; defaults to `Profil 1`). Both ways import followed shows (including their "stopped" status), movies to watch, the full watch history for shows + movies with actual dates, and show favorites, and end with a report (shows/movies not found on TMDB, total time compared against the TV Time reference). The import can be re-run without creating duplicates if interrupted.

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

The app listens on `http://localhost:3000` and compresses its own responses (Brotli or gzip), so it can be exposed as is, without a proxy in front. The SQLite database and the book cover cache are persisted in `./data/`.

To import the TV Time GDPR export, use Profile → **Import TV Time** in the app. (The CLI alternative from inside the container: uncomment the `gdpr` volume in `docker-compose.yml`, then `docker compose exec tvtime npx tsx scripts/import-tvtime.ts /gdpr`.)

## Configuration (`.env`)

| Variable | Purpose |
| --- | --- |
| `TMDB_API_KEY` | TMDB API key (required) |
| `GOOGLE_BOOKS_API_KEY` | Optional Google Books key used only after Inventaire, BnF and Open Library |
| `ORIGIN` | Exact URL used to access the app when deployed (e.g. `http://192.168.1.10:3000`) — required outside localhost, otherwise form submissions are rejected (CSRF) |
| `BODY_SIZE_LIMIT` | Max request size for the Node server (Node's default is 512K). Already set to `200M` in the Docker image; set it too if you run `node build/index.js` directly, otherwise large uploads (database import) fail with « Payload Too Large » |
| `DATABASE_PATH` | SQLite database path (default `./data/tvtime.db`) |
| `APP_TIMEZONE` | Timezone used for episode availability dates (default `Europe/Paris`) |

## Deploying to a server (CI + Portainer)

1. **Publish the repository on GitHub**: the CI (`.github/workflows/docker.yml`) builds the image on every push to `master`/`main` and pushes it to `ghcr.io/<user>/tvtimelocal:latest` (no secrets to configure, `GITHUB_TOKEN` is enough).
2. **Portainer**: Stacks → Add stack → paste `portainer-stack.yml` (replace `YOUR_USERNAME`), set `TMDB_API_KEY` and `ORIGIN` in the stack's environment variables. If the ghcr package is private, declare the registry in Portainer → Registries with a GitHub PAT (`read:packages`).
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

Book metadata comes primarily from Inventaire (open CC0 bibliographic data), enriched by the BnF and Open Library. Live camera scanning requires HTTPS, except on localhost.

This product uses the TMDB API but is not endorsed or certified by TMDB. Episode air times are provided by [TVmaze](https://www.tvmaze.com/).
