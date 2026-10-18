// MapLibre GL 6 loads its tile worker by URL as a separate module, which Metro doesn't serve.
// Copy it into public/ so the web app can load it from /maplibre-gl-worker.mjs (see TripMap.web.tsx).
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve('maplibre-gl/package.json'));
const out = join(here, '..', 'public');
mkdirSync(out, { recursive: true });
copyFileSync(join(pkgDir, 'dist', 'maplibre-gl-worker.mjs'), join(out, 'maplibre-gl-worker.mjs'));
console.log('Copied maplibre-gl-worker.mjs to public/');
