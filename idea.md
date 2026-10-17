# Tagalong — idea

> **Tagalong** is the app: the friend who tags along on every trip. **Laddoo** is the mascot, a baby elephant, because elephants never forget. Both names still need a trademark and App Store check; the idea doesn't change.

## One line

A travel buddy that **remembers how you travel** and always knows **what you should do next, right now**: where to go, what to eat and where, and how to get there. It re-plans the moment your day changes.

## The problem

When we travel we don't know what to do at what time. We google, watch reels, and end up doing whatever we stumble into. We don't know:

- what's famous to see here,
- what's famous to eat, and **where** to eat it,
- which transport is best between two places, and what it should cost,
- what to do *now*, when we're late, it's raining, a place is shut, or we just changed our mind.

Planning apps exist, but they stop at the plan. Once the trip starts, you're back to Google and Instagram.

## The north star

**Every screen answers: "What should I do next, and why, for me?"**

If a feature doesn't help a traveler decide or act on their next few hours, it doesn't ship. Use this to settle every scope argument.

## Who it's for

- **First:** Indian travelers, ages 18–35, on domestic trips of 2–7 days (Jaipur, Goa, Manali, Varanasi, Rishikesh, Udaipur, Kerala, Pondicherry, …). Solo, couples, and friend groups. Budget-aware. Inspired by reels and YouTube, not guidebooks.
- **Later:** the same traveler going abroad (Thailand, Bali, Dubai, Vietnam), then travelers anywhere.

## What makes it different

1. **Real time, not just pre-trip.** The plan is alive. Tagalong uses your location and the clock to re-plan the rest of the day when you're running late, it starts raining, a place is closed, you're hungry now, or you say "I'm bored" or "skip this".
2. **Never sends you somewhere closed.** Every stop is checked against live place data (exists, open at that hour, rated) before it's shown. The AI writes the plan; real data verifies it.
3. **Food is a hero, not a footnote.** Not "try local food" — "**Pyaaz kachori at Rawat, ₹40, go before 11 AM**". The famous dishes of each city, mapped to the specific places known for them.
4. **Transport you can act on.** For every hop: the best mode (walk, auto, metro, bus, cab, scooter rental), time, fair price range, and a tip ("insist on the meter", "pre-paid booth at exit 2").
5. **A guide with a face.** Laddoo, a cartoon baby elephant that feels alive. It talks, reacts, worries about the rain, and celebrates with you. It speaks your language, by voice or text.
6. **Fun to follow.** Checking into stops, collecting dishes and stamps, and completing city quests make the plan feel like a game, not homework.
7. **Fully yours.** Every stop can be swapped, moved, deleted or added by tap or by just telling Laddoo. Nothing is locked.
8. **Never forgets.** Laddoo remembers everything you tell it and everything it learns from how you travel: your diet, spice level, pace, budget, who you travel with, what you loved and what you skipped, across every trip. The second trip is better than the first, and you never answer the same question twice.

## What we are NOT building (anti-drift list)

- **Not a booking site / OTA.** We may link out or earn affiliate fees, but we never become a flights-and-hotels storefront. MakeMyTrip, Expedia and others own that.
- **Not a blank planning canvas.** Users shouldn't drag 40 pins around (that's Wanderlog). Tagalong proposes; users adjust.
- **Not a chatbot with a map bolted on.** Chat is one way to talk to Laddoo. The main surface is the live day plan.
- **Not a social network or review site.** No feeds, follower counts or user reviews in v1.
- **Not a listicle.** No "Top 25 things to do". Always a timed, routed, personal plan.
- **Not a navigation app.** We hand off to Google/Apple Maps or Uber/Ola/Rapido for turn-by-turn and rides.

## The core loop

```
Before the trip            During the trip (every day)                      After
───────────────            ───────────────────────────                      ─────
2-min quiz        ──►      Morning brief from Laddoo                ──►      Trip recap
(budget, vibe,             "Now" card: the next thing to do                 (stamps, dishes,
 food, pace…)              Check in at a stop → XP, stamp                   spend, map)
      │                    Something changes → Laddoo re-plans               Shareable card
      ▼                    "I'm hungry" / "I'm tired" / "skip"
Day-by-day plan            Evening: tomorrow's preview
(time-slotted,
 verified, priced)
```

## The pre-trip quiz

Short, playful, one question per screen, Laddoo reacting to every answer. Two minutes at most. Everything is optional except destination and dates.

1. Where and when? (city, dates, arrival time and mode — flight, train, bus, car)
2. Who's coming? (solo, partner, friends, family with kids, parents)
3. Budget per person per day, excluding stay (₹ slider with presets: backpacker / comfortable / treat yourself)
4. Pace? (chill — 2–3 things a day / balanced / pack it in)
5. What do you love? (pick any: history, food, nature, adventure, spiritual, shopping, nightlife, photography, offbeat)
6. Food? (veg / non-veg / egg / Jain / vegan; spice tolerance; street food yes or no; allergies)
7. Getting around? (walk a lot, autos and cabs, public transport, rent a scooter, own vehicle)
8. Where are you staying? (optional; it anchors start and end of each day)
9. Anything fixed? (a wedding at 7 PM, a booked tour)
10. Language for Laddoo (English, Hindi, Hinglish, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi, Odia)

## The plan

Each day is a timeline of **stops** and **hops**.

- **Stop:** a place, a time window, why it's worth it, the cost, a local tip, and its category (food, sight, nature, culture, shopping, nightlife). Food stops name the dish.
- **Hop:** how to get to the next stop: mode, minutes, ₹ range, and a tip.
- Each day fits the budget, respects opening hours, travel time, meal times and the user's pace, and leaves slack.
- A **"Now" card** is always on top: the one thing to do next, how far it is, and how to get there.

## Real-time re-planning

Tagalong re-plans the *rest of today* (never the past, never days the user didn't ask about). Every re-plan is shown as a change the user can accept or undo.

| Trigger | How we know | What Laddoo does |
|---|---|---|
| Running late | Location and clock vs plan | Shortens or drops the lowest-priority stop, keeps fixed ones |
| Rain or heat | Weather forecast | Swaps outdoor stops for indoor ones, reorders the day |
| Place closed | Live place data, user report | Offers the best nearby alternative |
| "I'm hungry" | User tap or voice | 3 options nearby that fit budget and diet, open now |
| "I'm tired" / "skip" | User | Removes or shortens, offers a café or a ride back |
| "Something fun nearby?" | User + location | Suggests a short detour that fits the time gap |
| Finished early | Check-in or location | Offers an extra stop or more time at the current one |
| Changed my mind | User edits or chat | Rebuilds around the change |

Location is foreground-only in v1: we update while the app is open and at check-ins. An opt-in background "Trip mode" (geofences on the next stops) comes later.

## Gamification

The game rewards actually travelling, not tapping.

- **Check-ins:** GPS-verified (within ~100 m) arrival at a stop gives XP and a city **stamp** in your Passport.
- **Dish collection:** each city has its iconic dishes. "Ate 4 of 6 of Jaipur's famous dishes."
- **City quests:** small optional missions ("Catch the sunset at Nahargarh", "Ride the Jaipur metro once", "Bargain in Johari Bazaar").
- **Map reveal:** the city map fills in as you explore.
- **Levels:** Tourist → Explorer → Wanderer → Local → Legend.
- **Streaks:** consecutive days on a trip where you followed at least one plan item. Never streaks that punish you for not travelling.
- **Trip recap:** a shareable card with stamps, dishes, distance and spend.

No leaderboards against strangers in v1. Competition is with yourself and your group.

## Memory: Laddoo never forgets

Memory is what makes the app personal, and the brand promise. Generic planners start from zero every time; Tagalong starts from you.

**What it remembers**

| Kind | Examples | Where it comes from |
|---|---|---|
| Facts about you | Vegetarian but eats eggs, medium spice, nothing before 8 AM, about ₹1,500 a day | Quiz answers, things you say in chat |
| Learned habits | Tired after about 4 stops, always lingers at sunsets, skips forts after lunch | Check-ins, skips, time spent, edits to the plan |
| Loves and skips | Rooftop cafés, old bazaars; no malls, no animal rides | Ratings, chat, skipped stops |
| Your people | Priya: vegan, loves museums, gets carsick on hill roads | You tell Laddoo once |
| Your history | Every trip, stop, dish, stamp and photo spot | The app records it |
| Promises | "Remind me to buy blue pottery for Mom", "Never suggest that café again" | Chat |

**How it shows up**

- **As the reason.** Suggestions explain themselves with memory: "You loved the mirchi vada in Jodhpur, so try this kachori." Users can see Laddoo learning.
- **No repeat questions.** The quiz for trip two asks only what's new (where, when, who). Everything else is pre-filled.
- **Across trips.** "Fewer forts in Udaipur, more lakes. You liked Hawa Mahal more than Amber Fort."
- **For the group.** Plans fit everyone on the trip, not just the person holding the phone.

**Rules**

- **You own it.** A "What Laddoo remembers" screen shows every memory, where it came from and when. Anything can be edited or forgotten in one tap, and "forget" really deletes it.
- **Ask before remembering sensitive things.** Health, religion, money trouble and anything about other people are saved only after the user agrees.
- **Say what was learned.** When Laddoo learns something new and important, it says so once ("Got it, no more animal rides") with an undo.
- **Never shared, never sold, never used for ads.** Memory is used only to plan the user's own trips.

## Laddoo, the mascot

- A baby elephant in a saffron bucket hat with a terracotta backpack. Named after the round Indian sweet. Elephants never forget a place, and the trunk points the way to the next stop. Cartoon, but alive: it breathes, blinks, flaps its ears, swings its trunk, and reacts to what's happening.
- Drawn in the same flat, no-outline illustration style as the city scenes, so it belongs in the world it walks through.
- **Moods:** idle, listening, thinking, talking, happy, excited (check-in, level up), worried (rain, running late), sleepy (late night), proud (day complete).
- **Voice:** speaks the user's chosen language. Mouth moves with the speech.
- **Personality:** a well-traveled local friend. Warm, quick, a little cheeky, never preachy. Short sentences. Gives an opinion ("Skip the fort café, the kachori is better") rather than a list.
- **Built in Rive** (state machine with data binding) so one file drives every mood, plus mouth shapes for speech.

## Design principles

Reference: [design/ui-direction.html](design/ui-direction.html). Open it in a browser and tap I'm here on the Today screen. Tokens: [design/colors.ts](design/colors.ts).

- **One thing at a time.** Each screen has one hero and one ink button. On the trail only the current stop is labeled. Today is the scene, the Now card, a quiet "Later today" timeline, and your food list. Nothing else.
- **The day is a game path through the city.** Each city is a layered, flat illustration of its skyline. The day's stops sit on a trail that winds from the foreground (done) to the horizon (tonight). Check in and Laddoo walks to the next stop.
- **Color lives in the art.** Screens stay calm: peach background, cream cards, ink text and buttons. Saturated color comes only from the scene, Laddoo and rewards. ("Golden hour" palette: peach, cream, ink, evening sky, terracotta, gold, leaf.)
- **The sky tells the time.** The scene's sky follows the real time of day: pale morning, blue afternoon, peach golden hour, indigo night with lit windows.
- **Calm, grown-up type.** Plus Jakarta Sans for Latin, paired with Noto Sans for each Indic script. No bubbly game fonts; the fun comes from the illustration and motion.
- **One ink button per screen.** The main action is a black pill. Everything else is cream or text.
- **Rewards are small and gold.** "+25 pts" chips with a gold coin that float up when earned. Dish cards and city stamps are illustrated mini-scenes in the same style.
- **Motion with meaning.** Springs, not linear tweens. Laddoo hops between stops; rows slide in when the plan changes. Respect Reduce Motion.
- **Glanceable outdoors.** High contrast (ink on peach is 11.8:1), big tap targets, the "Now" row readable in sunlight with one hand.

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| App | React Native with Expo (SDK 58, New Architecture), Expo Router, EAS Build | iOS and Android from one codebase. Needs dev builds (not Expo Go) for native sign-in, location and maps. |
| Auth | Clerk (`@clerk/expo`) | Native Google and Apple sign-in. |
| Data and storage | Supabase (Postgres, pgvector, Storage) | Clerk as Supabase third-party auth. RLS on `auth.jwt()->>'sub'`, user IDs stored as `text`. |
| Backend | Node.js (TypeScript) | Verifies Clerk tokens with `@clerk/backend`. Owns all AI and third-party API calls. Keys never ship in the app. |
| AI | Sarvam AI | Chat, tool calling, speech-to-text and text-to-speech in Indian languages. See AI section. |
| Motion | Reanimated 4 (+ Moti), Skia for effects, Rive for Laddoo, Lottie for one-off clips | GSAP doesn't run in React Native; it's only for a future marketing site. |
| Feedback | `expo-haptics`, `expo-audio` | |
| Location | `expo-location` (foreground), `expo-task-manager` later | |
| Maps | Mapbox (`@rnmapbox/maps`) | Same branded map style on both platforms. Fallback: `react-native-maps` with Google. |

## AI architecture (summary)

Details and sources are in [research/travel-companion.md](research/travel-companion.md).

**The rule: the AI proposes, real data verifies, code decides.** The LLM never invents a place, an opening hour, a travel time or a price. Those come from tools.

```
App (Expo) ──Clerk JWT──► Node backend ──► Sarvam (LLM, speech, voice)
                              │
                              ├─► Google Places (New) + Routes   (places, hours, ratings, ETAs)
                              ├─► Ola Maps                        (cheap fallback)
                              ├─► OpenWeather                     (rain, heat)
                              ├─► Tavily                          (famous dishes, what's trending)
                              ├─► Fare estimator (our code)       (₹ ranges; deep links to Uber, Ola, Rapido)
                              └─► Supabase                        (trips, plans, check-ins, cache)
```

1. **Plan and re-plan:** `sarvam-105b` with tools (`search_places`, `place_details`, `get_route`, `get_weather`, `web_search`, `estimate_fare`) and strict JSON schema output. Every stop must carry a `place_id`.
2. **Validate:** our own code checks every plan before the user sees it: open at that time, travel time fits, within budget, meals at meal times, pace respected. If a check fails, the plan goes back to the model with the reason.
3. **Talk:** `sarvam-105b-conversations` for chat with Laddoo. Voice in through Saaras real-time speech-to-text (auto language, Hinglish-aware). Voice out through Bulbul text-to-speech, streamed sentence by sentence. TTS loudness drives Laddoo's mouth.
4. **Memory:** every chat, check-in, skip and edit goes through a small extraction step. The model pulls out durable facts ("eats eggs", "Priya is vegan"), and the backend stores them in Supabase as typed rows (kind, value, source, confidence, date), plus pgvector embeddings for fuzzy recall. Before any plan or reply, the backend loads the core profile in full plus the memories most relevant to the request, and passes them to the model. Nothing depends on the model's context window to remember. Raw chat history is kept too, so a fact can always be traced to where it came from.
5. **Cache:** place details, routes and search results are cached in Supabase per city to cut cost and latency.
6. **Swappable model:** the LLM sits behind one interface, so we can fall back to another model if Sarvam is down or rate-limited.
7. **Prove it first:** before building screens, build an eval set of 30–50 real trip scenarios and check that Sarvam's tool calling produces valid, feasible plans.

## v1 scope (MVP)

1. Sign in (Google, Apple).
2. Pre-trip quiz → generated day-by-day plan for **one Indian city**, verified against live place data.
3. Today screen with the "Now" card, timeline, and hand-off to maps and ride apps.
4. Edit any stop by tap; ask Laddoo by text or voice to change things.
5. Re-plan triggers: running late, rain, place closed, "I'm hungry", "skip".
6. Check-ins, stamps, dish collection, XP and levels.
7. Laddoo with at least idle, thinking, talking, happy and worried moods.
8. Memory: Laddoo remembers quiz answers, chat facts and check-in habits, uses them in plans, and shows them on a "What Laddoo remembers" screen where each one can be edited or forgotten.
9. English, Hindi and Hinglish first.

Launch with 5 cities curated to a high standard, each with its own illustrated scene, (for example Jaipur, Goa, Varanasi, Udaipur, Rishikesh) rather than every city done badly.

## Later

- Import a reel, YouTube video or screenshot and turn it into stops.
- Group trips with shared plan and votes.
- Background Trip mode with geofences and proactive nudges.
- Offline day pack (plan, map tiles, phrases).
- More languages; international destinations.
- Affiliate links for rides, experiences and tickets.

## How we'll know it works

- **Plan accepted:** % of generated days where the user keeps at least 70% of stops.
- **In-trip use:** % of trip days where the user opens the app at least 3 times.
- **Check-ins per trip day.**
- **Re-plans accepted** vs undone.
- **Zero-closed-place rate:** reports of "this place was closed" per 100 visited stops.
- **Second trip:** % of users who plan another trip within 6 months.
- **Memory quality:** % of memories users keep vs edit or forget; questions re-asked per returning trip (target: zero).

## Open questions

- Final app and mascot names (check trademarks and App Store availability).
- Monetization: free core plus a low-priced premium (unlimited re-plans, offline packs, more languages) vs affiliate-only at first.
- How much city curation is human vs AI-generated and verified.
- Who designs and animates Laddoo (in-house vs a Rive animator), and who illustrates a scene for each launch city.
