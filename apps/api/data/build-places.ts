// Builds (or rebuilds) our places database for a city.
//   npm run data:places -w api -- jaipur
//   npm run data:places -w api -- "Kochi"        (any Indian city: its area is looked up automatically)
import { buildCityPlaces } from '../src/places/build.js';
import { cityArea } from '../src/places/ensureCity.js';

const name = process.argv.slice(2).join(' ').trim() || 'jaipur';
const area = await cityArea(name);
if (!area) throw new Error(`Couldn't find "${name}" in India.`);
await buildCityPlaces(area.key, area.name, area.bbox);
