# Tagalong

A travel buddy that remembers how you travel and always knows what you should do next. The product idea and its rules are in [idea.md](idea.md). Research is in [research/](research/), and the visual direction is in [design/ui-direction.html](design/ui-direction.html).

## What's here

| Path | What it is |
|---|---|
| `apps/mobile` | Expo SDK 58 app (iOS, Android, web). Expo Router, Reanimated 4, react-native-svg. |
| `apps/api` | Node API (Hono). Clerk auth, Sarvam client, the plan validator and fare estimator. |
| `packages/shared` | Domain types shared by the app and the API (`Stop`, `Memory`, `TripPreferences`, …). |
| `supabase/migrations` | Postgres schema with row-level security keyed on Clerk user IDs. |
| `scripts/test-db.sh` | Runs the migrations and RLS checks on a throwaway local Postgres. |

## Status

### Any destination, worked out on the fly

- **`POST /v1/trips/outline`** takes whatever the traveler typed ("Miami", "Japan", "Rajasthan", "Swiss Alps", "Taj Mahal", "somewhere warm") and returns either base cities with days and dates or one clarifying question. The AI proposes the route, and our code checks each city with OpenStreetMap's geocoder and makes the days add up. In a live test, 8 different requests all worked (Japan → Tokyo 4d + Kyoto 3d; Bali → Ubud + Seminyak; Taj Mahal → Agra).
- **`POST /v1/trips/plan-day`** then plans each day in its city. Places for a new city are built on demand.
- **Country-aware:** money is in the destination's currency, and each country has its own transport modes and fare model (`apps/api/src/places/countries.ts`). Countries without a fare model get travel times without prices, not made-up numbers. Sunrise and sunset use the city's own timezone.
- **Roads:** where our routing server has roads (north, central and west India today), travel times are real. Elsewhere they're estimated from distance and marked with "~" until that region's roads are added.
- **Web search (optional, recommended):** set `TAVILY_API_KEY` so the planner can look up what's famous, what's on and current prices anywhere. Without it, quality outside our curated Indian cities depends on open data and the AI's own knowledge.

### Our own places and routing (no Google)

- **Any city:** the API builds a city's places database automatically the first time someone plans a trip there (about a minute, then it's saved). Prebuilt so far: Jaipur, Goa, Varanasi, Udaipur and Rishikesh. Amritsar was tested on demand.
- **Places:** `npm run data:places -w api -- jaipur` (or any city name, e.g. `-- "Kochi"`) builds a city's places database. Jaipur has about 47,000 places. It merges Overture Maps places with OpenStreetMap points of interest (which supply opening hours, fees and Wikidata links where they exist) and adds a curated "known for" layer (`apps/api/data/curated/`). The output is gitignored. Opening hours are never invented: only about 130 places list them, and the rest show "not listed".
- **Routing:** run `docker-compose -f infra/valhalla/docker-compose.yml up -d` to start our own Valhalla server on OpenStreetMap roads at `localhost:8002`. It covers the northern, central and western India zones, so South and East India still need their extracts added. Road times are padded for traffic, because there's no live traffic data.
- **Planner:** uses these automatically when there's no Google key. Override with `PLACES_PROVIDER` and `ROUTES_PROVIDER`. Our code sets the exact schedule from real travel times and opening hours, and enforces diet as a hard rule.
- **Latest eval (3 Jaipur days):** 2 valid and passing every check, about ₹2 and 45 s per day. Known gaps: geography on packed days, empty afternoons, generic dishes ("street food"), food attached to a street rather than an eatery, and guessed entry fees.

### Database

The schema in `supabase/migrations` is applied to the Supabase project with RLS on every table. `DATABASE_URL` in `apps/api/.env` uses the IPv4 session pooler. Clerk still has to be connected to Supabase in both dashboards (Supabase → Authentication → Third-party auth).

### Our own map

- **Explore tab:** an interactive map of the day, with no Google involved. Pins match the trail (done, now, ahead), a solid line shows the path walked and a dashed line what's ahead, and tapping a stop zooms to it. Check-ins sync with Today.
- **Built on:** [MapLibre](https://maplibre.org) (open-source map engine) with OpenStreetMap data, served free by [OpenFreeMap](https://openfreemap.org), drawn in our own Golden hour style (`apps/mobile/src/map/style.ts`). OpenFreeMap needs no key and has no request limits, and we can self-host the same tiles later.
- **Platforms:** web uses MapLibre GL JS (`TripMap.web.tsx`). iOS and Android use MapLibre Native (`TripMap.tsx`), which needs a development build and **hasn't been run on a device yet**.
- **Credit:** OpenStreetMap's licence requires the "© OpenStreetMap contributors" line on any screen that shows the map.
- **Not yet:** route lines are straight between stops until we run our own router (Valhalla or OSRM), and the user's own location dot isn't on the map yet.

### Milestone 2: the planner

- `planDay()` runs Sarvam (`sarvam-105b`) with tools: `search_places`, `place_details`, `get_route`, `get_weather`, `web_search`, `recall_memories` and `submit_plan`.
- **The AI proposes, real data verifies, code decides.** The model only picks places (by Google place ID), times and order. Our code fills in names, opening hours, travel times and fares from Google, then `validateDay()` checks the day. Problems go back to the model as the `submit_plan` result, and it gets up to 3 tries.
- `POST /v1/trips/plan-day` plans one day of a trip.
- **Eval set:** 15 scenarios across Jaipur, Goa, Varanasi, Udaipur and Rishikesh, in `apps/api/evals/`. Each run is scored on validity, real places, dishes, skips, timing windows, walking limits and memory use. Run it with `npm run eval -w api` (add `-- --only jaipur-solo-veg --verbose` for one scenario). It makes real API calls, which cost money.

### Milestone 1

- **Mobile:** Welcome, Today (the illustrated trail with check-ins) and Me ("What Laddoo remembers") screens run on mock data. Explore, Laddoo chat and Passport are placeholders.
- **API:** `/health`, `/v1/me`, `/v1/fare`. Includes `validateDay()`, which rejects closed places, impossible timing, over-budget days, too many stops for the pace, too-early starts and missing lunch.
- **Database:** trips, days, stops, check-ins, dishes, memories (with consent for sensitive ones), chat history and a server-only place cache.
- **Not yet:** sign-in in the app, the app calling the planner, voice, and Laddoo in Rive.

## Run it

Use Node 24 (`nvm use`).

```bash
npm install
```

The app in a browser:

```bash
npm run web
```

The app on your phone: run `npm run mobile` and scan the QR code with Expo Go. Native sign-in, maps and Rive will need a development build later, through `npx eas-cli@latest build --profile development`, since this project doesn't need Xcode or Android Studio locally.

The API, after copying `apps/api/.env.example` to `apps/api/.env`:

```bash
npm run api
```

Tests (API unit tests, then the database checks; the database checks need `brew install postgresql@15`):

```bash
npm test
```

## Keys you'll need

| Service | Where | Used for |
|---|---|---|
| Clerk | `apps/api/.env`, later the app | Sign-in. Also connect Clerk to Supabase under Supabase → Authentication → Third-party auth. |
| Supabase | `apps/api/.env` | Database. Apply `supabase/migrations` with `supabase db push`. |
| Sarvam AI | `apps/api/.env` | Planning, chat, speech. |
| Google Maps Platform | `apps/api/.env` | Places, opening hours, routes. Bill it from an India account for India pricing. |
| OpenWeather, Tavily | `apps/api/.env` | Weather and web search for grounding. |

Keys stay on the server. The app only ever gets the Clerk publishable key and the Supabase URL and anon key.
