# Research: AI travel companion (Tagalong)

Researched 2026-10-17. The product idea itself is in [idea.md](../idea.md).

Many numbers below come from search summaries and vendor or competitor blogs, not primary sources. Items we could not verify are listed at the end of each section. Re-check prices before committing money.

## Summary

- **Real-time, in-trip re-planning is the open lane.** We found no consumer app that proactively re-plans a day's activities from live location, delays, weather or closures. Planners stop at the pre-trip plan. TripIt re-plans only flights.
- **The biggest threat is Google.** "Ask Maps" (Gemini in Google Maps) launched in March 2026 in the US and India. It builds itineraries from 300M+ places and already has location and navigation. No proactive re-planning has been reported yet. We need to move fast and win on personality, food and re-planning.
- **Trust is the moat.** A study of ChatGPT itineraries found errors in 90% of them. A quarter recommended a closed venue and half scheduled visits outside opening hours. "Never sends you to a closed place" is a promise we can market.
- **Food is weak everywhere.** Nobody does "dish X at place Y" well, and AI food picks can be gamed by fake reviews.
- **Memory looks like an opening.** None of the competitor features we found mention remembering a traveler's tastes across trips. We didn't check this in depth, so verify it by using Mindtrip, Layla and Myra for two trips each.
- **No AI planner has a mascot.** Gamification in travel works (Google Local Guides, Polarsteps, GPS stamp apps), but no AI planner uses it.
- **The stack works, with three changes.** GSAP doesn't run in React Native, so we use Reanimated and Rive. Sarvam has no web search, so we add a search API. Location data has to come from Google Places and Routes, not the LLM.

## Competitors

| Player | What it does | Re-plans during the trip? | Money | Weak spots |
|---|---|---|---|---|
| Layla | Chat planner with live prices. Bought Roam Around. **Acquired by Expedia (Jul 2026).** | No evidence | Freemium, about $49/yr | Thin free tier; weak at execution |
| Mindtrip | Chat plus map, 11M places. Builds a plan from a TikTok link or screenshot. Group chat. Added flights and stays in 2026. | No evidence | Free; booking commissions | Login wall before you see a plan |
| Wanderlog | Shared map-based itinerary canvas | Partial (route optimization, offline) | Pro about $40/yr; 5 free AI messages | Trustpilot 2/5: slow, buggy, billing complaints; mostly manual |
| Google Ask Maps | Gemini itineraries inside Maps (US and India, Mar 2026) | Not proactive yet, but has everything needed | Free | Early accuracy slips reported |
| Tripadvisor | AI itinerary builder; also inside ChatGPT and Claude | No | Ads, affiliate | |
| GuideGeek | Free AI assistant on WhatsApp and Instagram | Answers questions, but not location-aware | Free; B2B for tourism boards | Reactive only |
| TripIt | Organizes bookings; Pro has leave-now and delay alerts | Flights only | $49/yr | Not a planner |
| Stippl | Planner plus budget tools | No | €25/yr | Stability complaints |
| Airial | Social posts into itineraries. $3M seed (Jun 2025). | No evidence | Bookings, creators | Beta |
| MakeMyTrip Myra | Agentic planner, voice, text and image, Hindi and English beta (Aug 2025) | Post-sale support only | Booking | Main Indian incumbent; already speaks Hindi |
| Thrillophilia | AI builds 20+ bookable tour options, checks weather | Pre-trip only | Packages | Package-focused |
| EaseMyTrip | ChatGPT app for flights and hotels (Apr 2026) | No | Booking | Not a planner |

**What this means for us.** The Indian incumbents are booking-first. Hindi alone won't set us apart, since Myra already has it. We compete on the in-trip companion: live re-planning, verified food picks, the mascot and the game. Bookings come later through partners and affiliate links. Expedia buying Layla shows that travel companies buy AI planners.

## What travelers complain about

- **Wrong or invented places.** In north9's study, 90% of ChatGPT itineraries had errors. 1 in 4 included a closed venue, 52% had visits outside opening hours, and one invented a café. Even Google warns that its trip ideas may be inaccurate.
- **Generic, thin or paywalled plans.** This is the main complaint about Layla and Wanderlog.
- **Too much manual work.** Canvas planners make you do the planning yourself.
- **Inspiration lives on video.** YouTube is the top travel inspiration source for Indian travelers, and Gen Z prefers Instagram. Reels are replacing guidebooks. Mindtrip and Airial already turn reels into itineraries, so for us that's a "later" feature, not a differentiator.
- **Not done:** we didn't mine r/travel or r/IndiaTravel threads directly. Do it before finalizing the quiz.

## Market signals

- **Indian domestic travel:** 4.29B tourist visits in 2025, up 45.5%. That's inflated by the Kumbh Mela; 2024 had 2.95B.
- **Indian online travel:** about $23B in 2025, projected at $38.6B by 2031 (Mordor). Phocuswright puts all Indian travel at $41.7B, 57% of it online.
- **AI use:** 33% of Indian travelers already use AI to plan trips, and 68% say they will next time. The top uses are local attractions (38%) and itineraries (37%) (Agoda). 69% of Gen Z use GenAI to plan *and while traveling* (Booking.com via Statista).
- **Deals:** Expedia acquired Layla (Jul 2026). Mindtrip raised a Series B (Dec 2025). Airial raised a $3M seed. 30 Sundays (India) raised a $6.7M Series A led by Bessemer.

## Gamification that works in travel

- **Google Local Guides:** 10 levels and badges, 30M+ contributors. Status alone drives contribution.
- **Polarsteps:** an auto-tracked travel map and stats. 20M+ travelers, 25M+ trips tracked.
- **GPS stamps:** PopPop Seoul unlocks a stamp only within 50 m of a spot. Stample gives XP, stickers and city leaderboards.
- **Research:** a study of Poznań's CityQuest found location tasks, points and achievements raise engagement.
- **Patterns to copy:** proof-of-presence check-ins, a map that reveals as you explore, shareable progress, and status levels. Our additions are dish collection and a mascot narrator.

## Sarvam AI

**Models**

| Model | Use | Context | Notes |
|---|---|---|---|
| `sarvam-105b` | Build and re-plan itineraries (agentic, reasoning) | 128K | Tools, strict JSON schema output, streaming, `reasoning_effort` |
| `sarvam-105b-conversations` | Live chat and voice turns with Laddoo | 32K | Tuned for real-time dialogue |
| `gemma4` (beta, `/v2`) | Photos (menu, signboard) | 131K | The only chat model with vision; needs beta access |
| Saaras v4 / `saaras:v3-realtime` | Speech to text | — | Auto language ID, code-mix mode. Real-time over WebSocket (16 kHz PCM), REST takes ≤30 s clips |
| Bulbul v3 | Text to speech, Laddoo's voice | — | 30+ voices, streaming. Voice cloning in beta could give Laddoo its own voice |
| Mayura / Sarvam-Translate | Translation | — | |

Sarvam-M is gone and Sarvam-30B is deprecated.

**What it supports**

- The API is OpenAI-compatible, with base URL `https://api.sarvam.ai/v1` and Bearer auth. That URL comes from Pipecat's docs and a Sarvam migration guide, not Sarvam's main docs.
- `tools`, `tool_choice` and `response_format: json_schema` (strict) are supported. `parallel_tool_calls` is accepted but not enforced on 105B.
- Official `sarvamai` npm package. A community Vercel AI SDK provider (`sarvam-ai-sdk`) supports tools.

**Languages.** The LLM and Bulbul cover 11: English plus Hindi, Bengali, Tamil, Telugu, Kannada, Malayalam, Marathi, Gujarati, Punjabi and Odia. They handle romanized and code-mixed text such as Hinglish. Speech-to-text and translation cover 23 languages.

**Pricing** (₹100 free credit that never expires)

| Item | Price |
|---|---|
| sarvam-105b, per 1M tokens | ₹15 input / ₹5 cached / ₹60 output |
| Speech to text | ₹30 per hour |
| Bulbul v3 | ₹30 per 10K characters |
| Translation | ₹20 per 10K characters |

**Limits.** 105B allows 40 requests/min on Starter, 60 on Pro (₹10K) and 120 on Business (₹50K). `max_tokens` is capped at 4,096, 16,384 and 128K respectively.

**Gaps and how we fill them**

| Gap | Fix |
|---|---|
| No web search or grounding | A `web_search` tool backed by Tavily (or Serper at volume), cached per city and topic for 24 h+ |
| Knows nothing live about places, hours or traffic | Every place fact comes from tools (Google Places and Routes). The model must cite a `place_id` for every stop. |
| Rate limits (120 req/min at most) | Queue requests, cache prompts, use the conversations model for chat, keep a fallback model |
| Tool calling over long chains is unproven | **Build an eval set first:** 30–50 real trip scenarios scored for valid places, feasible timing and budget fit. Run it before committing. |

**Unverified:** whether Bulbul v4 is on the public TTS API, and the default `reasoning_effort` (the docs disagree, so always set it).

## Place, route, weather and search data

| Need | Pick | Free tier / price | Why |
|---|---|---|---|
| Places, hours, ratings, photos | **Google Places (New), India-billed account** | 35K free/month on Pro searches and details; Enterprise fields (ratings, hours) 7K free, then about $6–7.50 per 1K | Best India coverage of hours, reviews and photos. India pricing is about a third of global. |
| Cheap fallback (autocomplete, geocode, matrix) | Ola Maps | 100K free per API per month, then about ₹0.1–0.64 per call | Good Indian POIs, few ratings or photos |
| Routes and ETAs | Google Routes (India) | 70K free (Essentials), then $1.50 per 1K | Traffic-aware; transit in big metros |
| Metro and bus | City GTFS feeds where published (e.g. Delhi) | Free | Coverage varies by city |
| Ride fares | **Our own estimate formula + deep links** to Uber, Ola, Rapido | — | Uber's estimates API needs approval and bans price comparison. Ola and Rapido have no public APIs. |
| Weather | OpenWeather One Call 3.0 | 1,000 calls/day free | Open-Meteo's free tier is non-commercial only |
| Web search | Tavily | 1K credits/month free, then $0.008 per credit | Returns LLM-ready snippets |
| Events (later) | PredictHQ | Paid | BookMyShow and District have no public APIs |

We don't use the public OpenStreetMap or Overpass servers as a backend; their terms forbid it. Self-host if we need OSM.

## App stack

- **Expo SDK 58** (released 2026-10-15) ships React Native 0.88, New Architecture only. Expo Router's native tabs and toolbars are stable. Native sign-in, background location and maps need **dev builds**, not Expo Go. Android R8 minification is on by default in release builds, so run release builds on both platforms early.
- **Clerk:** use `@clerk/expo` v3. `@clerk/clerk-expo` is deprecated, with support until Jan 2027. Native Google sign-in uses `useSignInWithGoogle` and needs iOS, Android and Web OAuth client IDs. Native Apple sign-in uses `useSignInWithApple` (iOS only).
- **Clerk → Supabase:** use Supabase's native third-party auth integration; JWT templates were deprecated in April 2025. Pass `accessToken: () => getToken()` to `createClient`. RLS uses `auth.jwt()->>'sub'`, and user ID columns must be **`text`**, not `uuid` (Clerk IDs look like `user_…`).
- **Node backend:** `@clerk/backend` with `authenticateRequest()`, or `verifyToken()` with a JWT key for checks without a network call.
- **Location:**
  - **v1 is foreground-only.** Run a balanced-accuracy watch with a 50–100 m distance interval while the app is open, and re-plan at check-ins and app open. Server-side weather and closure checks arrive by push.
  - **Background "Trip mode" is a later opt-in.** iOS geofencing allows at most 20 regions, so rotate them across the next stops. Google Play requires a declaration form, a demo video and an in-app disclosure before the OS prompt. Apple needs a clear purpose string.
- **Motion:**
  - **GSAP is web-only.** There is no official React Native support, so use it only for a marketing site.
  - **Reanimated 4** (New Architecture only) for UI motion, with worklets in `react-native-worklets`. Moti on top, Skia for confetti and progress rings, Lottie for one-off clips.
- **Mascot:** use **Rive** with the new `@rive-app/react-native` runtime. Drive it through **Data Binding**, since the older state machine inputs are deprecated. View-model properties: `mood` (enum), `isTalking` (bool), `mouthOpen` (number) and triggers.
  - **Lip sync, v1:** drive `mouthOpen` from the TTS audio's loudness.
  - **Lip sync, better:** viseme timing mapped to about 12 mouth shapes, the way Duolingo does it. Bulbul doesn't give visemes as far as we know, so v1 uses loudness.
  - **Cost:** Rive's free plan doesn't export runtime files. Budget at least a Cadet seat ($17/month).
- **Maps:**
  - **Mapbox (`@rnmapbox/maps`)** gives one branded style on both platforms and offline tiles, and is paid after its free tier.
  - `react-native-maps` styling works only with the Google provider.
  - `expo-maps` is limited, with image-only markers and little iOS styling.
- **taste-skill** ([Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill)) is an MIT-licensed set of agent skills for design taste. It is web-focused, so use it for art direction and the brand kit, not for generating React Native code. To install it in Claude Code, run `/plugin marketplace add Leonxlnx/taste-skill`.

## Risks

- **Google Ask Maps adds proactive re-planning.** We'd lose the "first" claim. Mitigation: food depth, mascot and game, Indian languages by voice, and speed.
- **Sarvam tool-calling quality.** If 105B is unreliable at multi-step tool use, plans break. Mitigation: deterministic validation code, the eval set, and a fallback model behind the same interface.
- **Places API cost at scale.** Mitigation: cache place details in Supabase (within Google's caching terms), curate the top places for launch cities, and use Ola as a fallback.
- **Background location review.** Mitigation: foreground-only v1.
- **Fare accuracy.** Without ride APIs, prices are estimates. Show ranges, never exact fares.
- **Willingness to pay.** Indian users are price-sensitive and consumer planners charge $25–50 a year. Start free; test a low-priced premium and affiliate income.

## Sources

**Competitors and market**
- [Expedia acquires Layla](https://ir.expediagroup.com/news-and-events/news/news-details/2026/Expedia-Group-acquires-Layla-accelerating-its-AI-powered-trip-planning-and-booking-strategy/default.aspx)
- [Layla acquires Roam Around (Travolution)](https://www.travolution.com/news/travel-startup-layla-acquires-ai-powered-itinerary-builder-roam-around)
- [Layla vs Mindtrip 2026 (MonkeyTravel)](https://monkeytravel.app/blog/layla-vs-mindtrip-2026)
- [Best AI travel planner 2026 (Stippl)](https://app.stippl.io/blog/best-ai-travel-planner-2026)
- [Mindtrip (TechCrunch)](https://techcrunch.com/?p=2816045)
- [Mindtrip financials (CB Insights)](https://www.cbinsights.com/company/mindtrip/financials)
- [Wanderlog on Trustpilot](https://trustpilot.com/review/wanderlog.com)
- [Google vacation planning features (TechCrunch)](https://techcrunch.com/2025/03/27/google-rolls-out-new-vacation-planning-features-to-search-maps-and-gemini)
- [Google Ask Maps (Travolution)](https://www.travolution.com/news/google-maps-launches-ask-maps-and-immersive-navigation-with-gemini/)
- [GuideGeek about](https://guidegeek.com/about)
- [TripIt Pro pricing](https://tripit.com/es-co/web/pro/pricing)
- [Airial seed (TechCrunch)](https://techcrunch.com/2025/06/30/former-meta-engineers-airial-travel-tool-helps-travelers-solve-logistics-planning-with-ai)
- [MakeMyTrip Myra (PhocusWire)](https://www.phocuswire.com/makeymytrip-myra)
- [Thrillophilia AI (The Week)](https://www.theweek.in/wire-updates/business/2025/08/22/dcm4-thrillophilia.html)
- [EaseMyTrip ChatGPT app (NSE)](https://nsearchives.nseindia.com/corporate/EASEMYTRIP_02042026204305_pr_signed.pdf)
- [ChatGPT itinerary errors (Travolution)](https://www.travolution.com/news/marketing/survey-finds-chatgpt-itineraries-to-be-riddled-with-inaccuracies/)
- [AI hallucinates travel info (Frommer's)](https://www.frommers.com/tips/news/ai-hallucinates-crucial-travel-info-wrong-mistakes-like-this-can-be-dangerous-to-a-business/)
- [Indian travellers and YouTube/Instagram (PRmoment)](https://www.prmoment.in/pr-news/youtube-top-influencer-for-indian-travellers-for-gen-z-its-instagram-latest-finn-partners-report)
- [India tourism data compendium 2025 (Policy Edge)](https://www.policyedge.in/p/india-tourism-data-compendium-2025)
- [India online travel market (Mordor)](https://mordorintelligence.com/industry-reports/online-travel-market-in-india)
- [Agoda: Indian travelers and AI (PRNAsia)](https://en.prnasia.com/releases/apac/68-of-indian-travelers-likely-to-use-ai-for-their-next-trip-agoda-532275.shtml)
- [Gen Z and GenAI for travel (Statista)](https://www.statista.com/chart/amp/36471/gen-z-consults-gen-ai-for-travel-advice/)
- [30 Sundays Series A (Seedtable)](https://seedtable.com/companies/30-sundays/funding-rounds/series-a-2026-07)

**Gamification**
- [Google Local Guides levels](https://blog.google/products/earth/more-levels-and-more-way-contribute-local-guides-l)
- [Polarsteps 25M trips](https://www.polarsteps.com/news/polarsteps-reaches-25-million-tracked-trips-and-celebrates-the-adventures-behind-the-number)
- [PopPop Seoul (App Store)](https://apps.apple.com/us/app/-/id6744961871)
- [Stample (Product Hunt)](https://www.producthunt.com/products/stample)
- [CityQuest study](https://econjournals.sgh.waw.pl/TZAP/article/view/5359)

**Sarvam AI**
- [Models](https://docs.sarvam.ai/api/getting-started/models)
- [sarvam-105b](https://docs.sarvam.ai/api/getting-started/models/sarvam-105b)
- [Chat completions v1](https://docs.sarvam.ai/api-reference/chat/chat-completions-v1.md)
- [Chat completions v2](https://docs.sarvam.ai/api-reference/chat/chat-completions-v2.md)
- [Pricing](https://docs.sarvam.ai/api/getting-started/pricing)
- [Rate limits](https://docs.sarvam.ai/api/getting-started/ratelimits)
- [Speech to text](https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/overview)
- [Text to speech](https://docs.sarvam.ai/api/api-guides-tutorials/text-to-speech/overview)
- [SDKs](https://docs.sarvam.ai/api/getting-started/sdks)
- [Vercel AI SDK provider](https://docs.sarvam.ai/api/integration/vercel-ai-sdk)
- [Pipecat Sarvam LLM (base URL)](https://docs.pipecat.ai/server/services/llm/sarvam)

**Data APIs**
- [Google Maps Platform pricing](https://developers.google.com/maps/billing-and-pricing/pricing)
- [Google Maps India pricing](https://developers.google.com/maps/billing-and-pricing/india)
- [Ola Maps pricing](https://maps.olakrutrim.com/pricing)
- [Foursquare pricing](https://foursquare.com/products/pricing/)
- [Overpass usage policy](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html)
- [Uber price estimates API](https://developer.uber.com/docs/riders/references/api/v1.2/estimates-price-get)
- [OpenWeather pricing](https://openweathermap.org/full-price)
- [Open-Meteo pricing](https://open-meteo.com/en/pricing)
- [Tavily credits](https://docs.tavily.com/documentation/api-credits)
- [Brave Search API](https://brave.com/search/api/)
- [Perplexity pricing](https://docs.perplexity.ai/getting-started/pricing)

**App stack**
- [Expo SDK 58](https://expo.dev/changelog/sdk-58)
- [Expo SDK 55 (New Architecture only)](https://expo.dev/changelog/sdk-55)
- [Clerk Expo migration](https://clerk.com/articles/migrating-from-clerk-clerk-expo-to-clerk-expo-breaking-changes-native-components)
- [Clerk Expo 3.1](https://clerk.com/articles/what-changed-in-clerk-expo-sdk-3-1)
- [Supabase + Clerk third-party auth](https://supabase.com/docs/guides/auth/third-party/clerk)
- [Clerk verifyToken](https://clerk.com/docs/reference/backend/verify-token)
- [expo-location](https://docs.expo.dev/versions/latest/sdk/location/)
- [Google Play background location policy](https://support.google.com/googleplay/android-developer/answer/9799150?hl=en)
- [Reanimated 4 release](https://swmansion.com/blog/reanimated-4-stable-release-the-future-of-react-native-animations-ba68210c3713)
- [Rive React Native migration](https://rive.app/docs/runtimes/react-native/migration-guide)
- [Rive data binding](https://rive.app/docs/runtimes/react-native/data-binding)
- [Rive pricing](https://rive.app/docs/account-admin/pricing.md)
- [Duolingo visemes](https://blog.duolingo.com/world-character-visemes)
- [expo-maps](https://docs.expo.dev/versions/latest/sdk/maps/)
- [taste-skill](https://github.com/Leonxlnx/taste-skill)
