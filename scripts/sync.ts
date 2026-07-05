/** Rafraîchit manuellement toutes les séries en cours depuis TMDB : npm run sync */
import 'dotenv/config';
import { syncOngoingShows } from '../src/lib/server/sync';

await syncOngoingShows();
