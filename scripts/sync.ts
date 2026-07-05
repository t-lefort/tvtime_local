/** Rafraîchit manuellement les séries en cours et les plateformes de streaming : npm run sync */
import 'dotenv/config';
import { syncOngoingShows, syncProviders } from '../src/lib/server/sync';

await syncOngoingShows();
await syncProviders();
